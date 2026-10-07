import * as THREE from 'three/webgpu';
import { UpgradeSystem } from '@/systems/UpgradeSystem';
import { raycastGround } from '@/core/groundRaycast';

const hitPoint = new THREE.Vector3();

export const enum StructureKind {
  Tower = 0,
  Wall = 1,
  Healing = 2,
  Cannon = 3,
}

export type GhostShape = 'cylinder' | 'box';

/**
 * Everything the placement system needs to know about one structure kind.
 * `spawn` closes over the kind-specific field + stats (built in main.ts), so
 * this system never has to import TowerField/WallField/etc. directly — it
 * only knows the shared placement/preview contract.
 */
export interface StructureDef {
  kind: StructureKind;
  name: string;
  cost: number;
  radius: number;
  scale: number;
  color: number;
  shape: GhostShape;
  height: number;
  /** Performs the actual field.spawn() with this kind's baked-in stats; returns the pool index or -1 if the field is full. */
  spawn(x: number, z: number): number;
}

/**
 * Build-mode input: number keys 1..N (or the Planning palette) select which
 * structure kind is active; 'B' toggles placement mode; a ghost mesh
 * previews the cursor's ground position with the selected kind's
 * geometry/color; left click confirms a spawn if there is enough currency.
 * Spends from UpgradeSystem's existing currency counter.
 */
export class StructurePlacementSystem {
  placementMode = false;
  /** Gates all placement input — false while an overlay covers the canvas so clicks don't bleed through. */
  enabled = false;
  selectedIndex = 0;

  private ghost: THREE.Mesh;
  private cursorX = 0;
  private cursorZ = 0;
  private hasCursor = false;
  private onSelectionChange?: (index: number) => void;

  constructor(
    private container: HTMLElement,
    private camera: THREE.OrthographicCamera,
    private scene: THREE.Scene,
    readonly defs: readonly StructureDef[],
    private upgrades: UpgradeSystem,
  ) {
    this.ghost = new THREE.Mesh(this.buildGeometry(defs[0]), this.buildMaterial(defs[0].color));
    this.ghost.visible = false;
    this.scene.add(this.ghost);

    window.addEventListener('keydown', this.onKeyDown);
    this.container.addEventListener('mousemove', this.onMouseMove);
    this.container.addEventListener('mousedown', this.onMouseDown);
  }

  get currency(): number {
    return this.upgrades.currency;
  }

  get selectedDef(): StructureDef {
    return this.defs[this.selectedIndex];
  }

  /** Called whenever the selected structure kind changes, so UI (e.g. the Planning palette) can mirror it. */
  setOnSelectionChange(cb: (index: number) => void): void {
    this.onSelectionChange = cb;
  }

  // No early-return on "already selected" — re-pressing/re-clicking the
  // current kind must still arm placement mode (e.g. the default selection
  // never changes index on its first use, so a change-only guard would leave
  // it permanently un-armed).
  select(index: number): void {
    if (index < 0 || index >= this.defs.length) return;
    if (index !== this.selectedIndex) {
      this.selectedIndex = index;
      this.rebuildGhost();
      this.onSelectionChange?.(index);
    }
    this.placementMode = true;
    this.ghost.visible = this.hasCursor;
  }

  private buildGeometry(def: StructureDef): THREE.BufferGeometry {
    return def.shape === 'box'
      ? new THREE.BoxGeometry(def.radius * 2, def.height, def.radius * 2)
      : new THREE.CylinderGeometry(def.radius, def.radius, def.height, 10);
  }

  private buildMaterial(color: number): THREE.MeshBasicNodeMaterial {
    return new THREE.MeshBasicNodeMaterial({ color, transparent: true, opacity: 0.45 });
  }

  // Selection changes only happen on a keypress/UI click, never per frame,
  // so swapping geometry/material here does not violate the no-alloc loop rule.
  private rebuildGhost(): void {
    const def = this.selectedDef;
    this.ghost.geometry.dispose();
    (this.ghost.material as THREE.Material).dispose();
    this.ghost.geometry = this.buildGeometry(def);
    this.ghost.material = this.buildMaterial(def.color);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    if (e.code === 'KeyB') {
      this.placementMode = !this.placementMode;
      this.ghost.visible = this.placementMode && this.hasCursor;
      return;
    }
    const digit = Number(e.code.replace('Digit', ''));
    if (Number.isInteger(digit) && digit >= 1 && digit <= this.defs.length) {
      this.select(digit - 1);
    }
  };

  /** Called on every Planning<->other-state transition so stray clicks never reach placement outside the build phase. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.placementMode = false;
      this.ghost.visible = false;
    }
  }

  private updateCursorFromEvent(e: MouseEvent): boolean {
    if (!raycastGround(e, this.container, this.camera, hitPoint)) return false;
    this.cursorX = hitPoint.x;
    this.cursorZ = hitPoint.z;
    return true;
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.enabled) return;
    this.hasCursor = this.updateCursorFromEvent(e);
    if (!this.placementMode) return;
    this.ghost.visible = this.hasCursor;
    const def = this.selectedDef;
    if (this.hasCursor) this.ghost.position.set(this.cursorX, def.height / 2, this.cursorZ);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.enabled || e.button !== 0 || !this.placementMode || !this.hasCursor) return;
    this.tryPlace();
  };

  private tryPlace(): boolean {
    const def = this.selectedDef;
    if (!this.upgrades.spendCurrency(def.cost)) return false;
    const idx = def.spawn(this.cursorX, this.cursorZ);
    if (idx === -1) {
      this.upgrades.addCurrency(def.cost);
      return false;
    }
    return true;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.container.removeEventListener('mousemove', this.onMouseMove);
    this.container.removeEventListener('mousedown', this.onMouseDown);
    this.scene.remove(this.ghost);
  }
}
