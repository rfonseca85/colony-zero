import * as THREE from 'three/webgpu';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimatedCharacter } from '@/core/AnimatedCharacter';

export interface PlayerInputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
}

/** World-space height the rig is scaled to — tuned so the player reads clearly against the enemy swarm without towering over structures. */
const PLAYER_HEIGHT = 1.8;

/**
 * Single-entity player; no pool needed since there is exactly one, but it
 * still avoids per-frame allocation (reuses a scratch vector).
 */
export class Player {
  readonly mesh: THREE.Object3D;
  private readonly character: AnimatedCharacter;
  x = 0;
  z = 0;
  speed = 8;
  hp = 100;
  maxHp = 100;
  fireCooldown = 0.16;
  damage = 12;
  /** Ability-tree hooks — set by AbilityTreeSystem.applyAll(), read by CombatSystem. */
  multishotCount = 1;
  explosiveSplash = 0;
  secondWindAvailable = false;
  private fireTimer = 0;
  private wasMoving = false;

  constructor(gltf: GLTF) {
    this.character = new AnimatedCharacter(gltf, PLAYER_HEIGHT, 'AK');
    this.mesh = this.character.root;
    this.character.play('Idle', 0);
  }

  update(dt: number, input: PlayerInputState): void {
    let dx = 0;
    let dz = 0;
    if (input.up) dz -= 1;
    if (input.down) dz += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;

    const moving = dx !== 0 || dz !== 0;
    if (moving) {
      const len = Math.sqrt(dx * dx + dz * dz);
      dx /= len;
      dz /= len;
      this.x += dx * this.speed * dt;
      this.z += dz * this.speed * dt;
      this.mesh.rotation.y = Math.atan2(dx, dz);
    }

    this.mesh.position.x = this.x;
    this.mesh.position.z = this.z;

    if (moving !== this.wasMoving) {
      this.character.play(moving ? 'Run' : 'Idle');
      this.wasMoving = moving;
    }
    this.character.update(dt);

    if (this.fireTimer > 0) this.fireTimer -= dt;
  }

  /** Faces the mesh toward a world-space direction — used to aim at the cursor regardless of movement. */
  faceDirection(dx: number, dz: number): void {
    if (dx === 0 && dz === 0) return;
    this.mesh.rotation.y = Math.atan2(dx, dz);
  }

  /** Returns true (and resets the cooldown) if the player is ready to fire. */
  tryFire(): boolean {
    if (this.fireTimer > 0) return false;
    this.fireTimer = this.fireCooldown;
    return true;
  }
}
