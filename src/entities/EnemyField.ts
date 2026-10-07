import * as THREE from 'three/webgpu';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ObjectPool } from '@/core/ObjectPool';
import { SpatialHashGrid } from '@/core/SpatialHashGrid';
import { ObstacleBuffer } from '@/core/ObstacleBuffer';
import { AnimatedCharacter } from '@/core/AnimatedCharacter';

/** Base world-space height (before a spawn's own `scale` multiplier) — keeps basic enemies a bit smaller than the player, elites towering via the existing scale range. */
const ENEMY_BASE_HEIGHT = 1.6;

export const enum EnemyKind {
  Basic = 0,
  Elite = 1,
  Ranged = 2,
}

export interface EnemySpawnParams {
  x: number;
  z: number;
  hp: number;
  speed: number;
  radius: number;
  scale: number;
  damage: number;
  kind?: EnemyKind;
  /** Ranged-kind only: stops closing distance once within this range and fires instead. */
  attackRange?: number;
  attackCooldown?: number;
}

export type RangedAttackCallback = (x: number, z: number, dirX: number, dirZ: number, damage: number) => void;

/**
 * Pooled enemies, each a real cloned/animated character (same AnimatedCharacter
 * class as Player and TowerField) rather than an InstancedMesh with baked or
 * procedural animation. An earlier version flattened the character into a
 * single vertex-colored InstancedMesh and drove it with a vertex-animation
 * texture for arbitrary-scale performance — mechanically correct (verified
 * with real baked motion, zero console errors) but the flattening/baking
 * pipeline visibly degraded how the character looked, which matters more
 * than raw instance count for a horde the player looks at constantly. This
 * trades "thousands of enemies" for "every enemy looks exactly as correct
 * as the player" — capacity stays in the hundreds, each instance is a
 * genuine SkinnedMesh + AnimationMixer, pre-built once in the constructor
 * and only repositioned/shown/hidden/crossfaded on spawn/kill/update — no
 * `new` during gameplay.
 */
export class EnemyField {
  readonly capacity: number;
  readonly root: THREE.Group;
  readonly pool: ObjectPool;

  readonly posX: Float32Array;
  readonly posZ: Float32Array;
  readonly velX: Float32Array;
  readonly velZ: Float32Array;
  readonly hp: Float32Array;
  readonly maxHp: Float32Array;
  readonly speed: Float32Array;
  readonly radius: Float32Array;
  readonly damage: Float32Array;
  readonly scale: Float32Array;
  readonly kind: Uint8Array;
  readonly attackRange: Float32Array;
  readonly attackCooldown: Float32Array;
  readonly attackTimer: Float32Array;

  private readonly instances: AnimatedCharacter[];
  private grid: SpatialHashGrid;
  private queryScratch: Int32Array;

  constructor(capacity: number, worldSize: number, gltf: GLTF) {
    this.capacity = capacity;
    this.pool = new ObjectPool(capacity);

    this.posX = new Float32Array(capacity);
    this.posZ = new Float32Array(capacity);
    this.velX = new Float32Array(capacity);
    this.velZ = new Float32Array(capacity);
    this.hp = new Float32Array(capacity);
    this.maxHp = new Float32Array(capacity);
    this.speed = new Float32Array(capacity);
    this.radius = new Float32Array(capacity);
    this.damage = new Float32Array(capacity);
    this.scale = new Float32Array(capacity);
    this.kind = new Uint8Array(capacity);
    this.attackRange = new Float32Array(capacity);
    this.attackCooldown = new Float32Array(capacity);
    this.attackTimer = new Float32Array(capacity);

    this.root = new THREE.Group();
    this.instances = new Array(capacity);
    for (let i = 0; i < capacity; i++) {
      const inst = new AnimatedCharacter(gltf, ENEMY_BASE_HEIGHT, null); // bare-handed — no weapon prop for the horde
      inst.root.visible = false;
      inst.play('Idle', 0);
      this.root.add(inst.root);
      this.instances[i] = inst;
    }

    this.grid = new SpatialHashGrid(worldSize, worldSize, 3, capacity);
    this.queryScratch = new Int32Array(256);
  }

  spawn(p: EnemySpawnParams): number {
    const idx = this.pool.acquire();
    if (idx === -1) return -1;
    const kind = p.kind ?? EnemyKind.Basic;
    this.posX[idx] = p.x;
    this.posZ[idx] = p.z;
    this.velX[idx] = 0;
    this.velZ[idx] = 0;
    this.hp[idx] = p.hp;
    this.maxHp[idx] = p.hp;
    this.speed[idx] = p.speed;
    this.radius[idx] = p.radius;
    this.damage[idx] = p.damage;
    this.scale[idx] = p.scale;
    this.kind[idx] = kind;
    this.attackRange[idx] = p.attackRange ?? 0;
    this.attackCooldown[idx] = p.attackCooldown ?? 1;
    this.attackTimer[idx] = Math.random() * this.attackCooldown[idx]; // desync volleys fired by simultaneously-spawned ranged enemies

    const inst = this.instances[idx];
    inst.root.position.set(p.x, 0, p.z);
    inst.root.scale.setScalar(inst.baseScale * p.scale);
    inst.root.rotation.y = Math.random() * Math.PI * 2;
    inst.root.visible = true;
    inst.play('Idle', 0);
    return idx;
  }

  kill(idx: number): void {
    this.pool.release(idx);
    this.instances[idx].root.visible = false;
  }

  /** Clears every live enemy — used when a wave ends so the next attempt doesn't inherit the prior horde. */
  killAll(): void {
    const alive = this.pool.alive;
    let count = this.pool.liveCount;
    while (count > 0) {
      this.kill(alive[count - 1]);
      count = this.pool.liveCount;
    }
  }

  /**
   * Seeks every live enemy toward (targetX, targetZ) — except ranged kinds,
   * which stop at attackRange and fire via onRangedAttack instead — pushes
   * them out of any overlapping obstacle, integrates position, crossfades
   * each instance's Run/Idle animation to match its movement state, and
   * rebuilds the spatial grid. All scratch state is pre-allocated; no
   * `new` here.
   */
  update(dt: number, targetX: number, targetZ: number, obstacles: ObstacleBuffer, onRangedAttack: RangedAttackCallback): void {
    const alive = this.pool.alive;
    const count = this.pool.liveCount;

    this.grid.clear();

    for (let i = 0; i < count; i++) {
      const idx = alive[i];
      const dx = targetX - this.posX[idx];
      const dz = targetZ - this.posZ[idx];
      const distSq = dx * dx + dz * dz;
      const dist = Math.sqrt(distSq) || 1;
      const invDist = 1 / dist;
      const dirX = dx * invDist;
      const dirZ = dz * invDist;

      const isRanged = this.kind[idx] === EnemyKind.Ranged;
      const inAttackRange = isRanged && dist <= this.attackRange[idx];

      if (inAttackRange) {
        this.velX[idx] = 0;
        this.velZ[idx] = 0;
        this.attackTimer[idx] -= dt;
        if (this.attackTimer[idx] <= 0) {
          this.attackTimer[idx] = this.attackCooldown[idx];
          onRangedAttack(this.posX[idx], this.posZ[idx], dirX, dirZ, this.damage[idx]);
        }
      } else {
        this.velX[idx] = dirX * this.speed[idx];
        this.velZ[idx] = dirZ * this.speed[idx];
        this.posX[idx] += this.velX[idx] * dt;
        this.posZ[idx] += this.velZ[idx] * dt;
      }

      // Push out of any overlapping structure (walls/towers/etc act as solid obstacles).
      for (let o = 0; o < obstacles.count; o++) {
        const ox = obstacles.x[o];
        const oz = obstacles.z[o];
        const minDist = obstacles.radius[o] + this.radius[idx];
        const pdx = this.posX[idx] - ox;
        const pdz = this.posZ[idx] - oz;
        const pDistSq = pdx * pdx + pdz * pdz;
        if (pDistSq < minDist * minDist && pDistSq > 0.0001) {
          const pDist = Math.sqrt(pDistSq);
          const push = (minDist - pDist) / pDist;
          this.posX[idx] += pdx * push;
          this.posZ[idx] += pdz * push;
        }
      }

      this.grid.insert(idx, this.posX[idx], this.posZ[idx]);

      const yaw = Math.atan2(dirX, dirZ);
      const inst = this.instances[idx];
      inst.root.position.x = this.posX[idx];
      inst.root.position.z = this.posZ[idx];
      inst.root.rotation.y = yaw;
      inst.play(inAttackRange ? 'Idle' : 'Run');
      inst.update(dt);
    }
  }

  /** Writes up to out.length nearby live enemy indices into `out`, returns count. */
  queryNearby(x: number, z: number, radius: number, out: Int32Array = this.queryScratch): number {
    return this.grid.queryRadius(x, z, radius, out);
  }

  findNearest(x: number, z: number, maxRadius: number): number {
    const count = this.queryNearby(x, z, maxRadius, this.queryScratch);
    let best = -1;
    let bestDistSq = Infinity;
    for (let i = 0; i < count; i++) {
      const idx = this.queryScratch[i];
      const dx = this.posX[idx] - x;
      const dz = this.posZ[idx] - z;
      const d = dx * dx + dz * dz;
      if (d < bestDistSq) {
        bestDistSq = d;
        best = idx;
      }
    }
    return best;
  }
}
