import * as THREE from 'three/webgpu';
import { EnemyField } from '@/entities/EnemyField';
import { Player } from '@/entities/Player';

const projected = new THREE.Vector3();
const screenPoint = { x: 0, y: 0 };

const PLAYER_COLOR = '#4f8ef7';
const STRUCTURE_COLOR = '#4f8ef7';
const ENEMY_COLOR = '#e2574c';

export interface StructureBarSource {
  pool: { alive: Int32Array; liveCount: number };
  posX: Float32Array;
  posZ: Float32Array;
  hp: Float32Array;
  maxHp: Float32Array;
}

/**
 * 2D canvas overlay drawn on top of the WebGPU canvas — cheap way to put a
 * health bar over every instanced entity without a second InstancedMesh per
 * bar. Projects world position to screen space each frame; no DOM nodes per
 * entity, so it stays fast even with hundreds of enemies alive.
 */
export class HealthBarOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position: absolute; inset: 0; z-index: 5; pointer-events: none;';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = (): void => {
    this.canvas.width = this.container.clientWidth;
    this.canvas.height = this.container.clientHeight;
  };

  private project(camera: THREE.Camera, x: number, y: number, z: number): boolean {
    projected.set(x, y, z).project(camera);
    if (projected.z < -1 || projected.z > 1) return false;
    screenPoint.x = (projected.x * 0.5 + 0.5) * this.canvas.width;
    screenPoint.y = (-projected.y * 0.5 + 0.5) * this.canvas.height;
    return true;
  }

  private drawBar(widthPx: number, frac: number, color: string): void {
    const h = 4;
    const x = screenPoint.x - widthPx / 2;
    const y = screenPoint.y;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    this.ctx.fillRect(x - 1, y - 1, widthPx + 2, h + 2);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    this.ctx.fillRect(x, y, widthPx, h);
    if (frac > 0) {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, y, widthPx * Math.max(0, Math.min(1, frac)), h);
    }
  }

  update(camera: THREE.Camera, player: Player, enemies: EnemyField, structures: readonly StructureBarSource[]): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.project(camera, player.x, 2.0, player.z)) {
      this.drawBar(32, player.hp / player.maxHp, PLAYER_COLOR);
    }

    for (const field of structures) {
      const alive = field.pool.alive;
      const count = field.pool.liveCount;
      for (let i = 0; i < count; i++) {
        const idx = alive[i];
        if (this.project(camera, field.posX[idx], 2.2, field.posZ[idx])) {
          this.drawBar(36, field.hp[idx] / field.maxHp[idx], STRUCTURE_COLOR);
        }
      }
    }

    const eAlive = enemies.pool.alive;
    const eCount = enemies.pool.liveCount;
    for (let i = 0; i < eCount; i++) {
      const idx = eAlive[i];
      const yOffset = enemies.scale[idx] * 1.6 + 0.3; // character height (1.6 baseline) scaled per-instance, plus a margin above the head
      if (this.project(camera, enemies.posX[idx], yOffset, enemies.posZ[idx])) {
        this.drawBar(20, enemies.hp[idx] / enemies.maxHp[idx], ENEMY_COLOR);
      }
    }
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.canvas.remove();
  }
}
