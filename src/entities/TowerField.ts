import * as THREE from 'three/webgpu';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ObjectPool } from '@/core/ObjectPool';
import { AnimatedCharacter } from '@/core/AnimatedCharacter';

/** Base world-space height a tower is scaled to (before a spawn's own `scale` multiplier) — slightly taller than the player so it reads as a fortified position, not just another survivor. */
const TOWER_HEIGHT = 2.0;

export interface TowerSpawnParams {
  x: number;
  z: number;
  hp: number;
  radius: number;
  scale: number;
  fireRange: number;
  fireCooldown: number;
  damage: number;
}

/**
 * Pooled towers, each a real cloned/animated character (Phase 1 asset
 * swap) rather than an InstancedMesh — skinned-mesh animation needs its own
 * Skeleton + AnimationMixer per instance, which is affordable here because
 * tower capacity is small (dozens, not thousands; EnemyField/ProjectileField
 * stay on the InstancedMesh path for exactly that reason). Every instance is
 * pre-built once in the constructor and only repositioned/shown/hidden on
 * spawn/kill — no `new` during gameplay.
 */
export class TowerField {
  readonly capacity: number;
  readonly root: THREE.Group;
  readonly pool: ObjectPool;

  readonly posX: Float32Array;
  readonly posZ: Float32Array;
  readonly hp: Float32Array;
  readonly maxHp: Float32Array;
  readonly radius: Float32Array;
  readonly fireRange: Float32Array;
  readonly fireCooldown: Float32Array;
  readonly fireTimer: Float32Array;
  readonly damage: Float32Array;

  private readonly instances: AnimatedCharacter[];

  constructor(capacity: number, gltf: GLTF) {
    this.capacity = capacity;
    this.pool = new ObjectPool(capacity);

    this.posX = new Float32Array(capacity);
    this.posZ = new Float32Array(capacity);
    this.hp = new Float32Array(capacity);
    this.maxHp = new Float32Array(capacity);
    this.radius = new Float32Array(capacity);
    this.fireRange = new Float32Array(capacity);
    this.fireCooldown = new Float32Array(capacity);
    this.fireTimer = new Float32Array(capacity);
    this.damage = new Float32Array(capacity);

    this.root = new THREE.Group();
    this.instances = new Array(capacity);
    for (let i = 0; i < capacity; i++) {
      const inst = new AnimatedCharacter(gltf, TOWER_HEIGHT, 'AK');
      inst.root.visible = false;
      inst.play('Idle', 0);
      this.root.add(inst.root);
      this.instances[i] = inst;
    }
  }

  spawn(p: TowerSpawnParams): number {
    const idx = this.pool.acquire();
    if (idx === -1) return -1;
    this.posX[idx] = p.x;
    this.posZ[idx] = p.z;
    this.hp[idx] = p.hp;
    this.maxHp[idx] = p.hp;
    this.radius[idx] = p.radius;
    this.fireRange[idx] = p.fireRange;
    this.fireCooldown[idx] = p.fireCooldown;
    this.fireTimer[idx] = 0;
    this.damage[idx] = p.damage;

    const inst = this.instances[idx];
    inst.root.position.x = p.x;
    inst.root.position.z = p.z;
    inst.root.rotation.y = Math.random() * Math.PI * 2; // face an arbitrary direction — towers don't track a target visually in Phase 1
    inst.root.visible = true;
    return idx;
  }

  kill(idx: number): void {
    this.pool.release(idx);
    this.instances[idx].root.visible = false;
  }

  /** Clears every live tower — used on wave reset so a failed run doesn't leave structures behind. */
  killAll(): void {
    const alive = this.pool.alive;
    let count = this.pool.liveCount;
    while (count > 0) {
      this.kill(alive[count - 1]);
      count = this.pool.liveCount;
    }
  }

  /** Ticks fire cooldowns and the animation mixer for every live tower. */
  update(dt: number): void {
    const alive = this.pool.alive;
    const count = this.pool.liveCount;
    for (let i = 0; i < count; i++) {
      const idx = alive[i];
      if (this.fireTimer[idx] > 0) this.fireTimer[idx] -= dt;
      this.instances[idx].update(dt);
    }
  }

  /** Returns true (and resets the cooldown) if the tower at idx is ready to fire. */
  tryFire(idx: number): boolean {
    if (this.fireTimer[idx] > 0) return false;
    this.fireTimer[idx] = this.fireCooldown[idx];
    this.instances[idx].playOnce('Idle_Shoot', 'Idle');
    return true;
  }
}
