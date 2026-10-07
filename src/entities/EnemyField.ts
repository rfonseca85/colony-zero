import * as THREE from 'three/webgpu';
import { rotate, positionLocal, positionGeometry, time, sin, vec3, float, instancedBufferAttribute } from 'three/tsl';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ObjectPool } from '@/core/ObjectPool';
import { SpatialHashGrid } from '@/core/SpatialHashGrid';
import { ObstacleBuffer } from '@/core/ObstacleBuffer';
import { extractStaticColoredGeometry, groundAlignGeometry, scaleGeometryToHeight } from '@/core/StaticMeshExtractor';
import { WEAPON_NODE_NAMES } from '@/core/AssetManager';

const DUMMY = new THREE.Object3D();
const PARKED_SCALE = 0.0001; // "deleted" instances are scaled to ~0 and parked far below the ground

/** Base world-space height (before a spawn's own `scale` multiplier) — keeps basic enemies a bit smaller than the player, elites towering via the existing scale range. */
const ENEMY_BASE_HEIGHT = 1.6;

// Procedural "alive" look for the horde — no AnimationMixer/SkinnedMesh per
// Fase 2's brief; InstancedMesh stays a single draw call for thousands of
// enemies, and liveliness comes entirely from a TSL vertex shader instead.
const TILT_ANGLE = 0.32; // radians of forward lean, baked as a fixed per-vertex delta then re-oriented by each instance's own yaw
const BOB_SPEED = 10;
const BOB_AMOUNT = 0.14;

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
 * Struct-of-arrays enemy storage rendered via a single InstancedMesh built
 * from the real Character_Enemy asset (Fase 2): every SkinnedMesh part is
 * flattened into one static geometry with its material colors baked to a
 * vertex-color attribute (see StaticMeshExtractor) — no per-instance
 * Skeleton/AnimationMixer, since that doesn't scale to thousands of
 * instances. Liveliness instead comes from a TSL vertex shader: a bob and a
 * forward tilt, both computed per-instance from a custom yaw/phase buffer
 * attribute rather than CPU-side geometry work.
 *
 * Entities are never created/destroyed at runtime — only acquired/released
 * from a fixed-capacity ObjectPool. Per-frame work touches only typed
 * arrays; the only "new" calls happen once, in the constructor.
 */
export class EnemyField {
  readonly capacity: number;
  readonly mesh: THREE.InstancedMesh;
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

  private readonly instanceYaw: THREE.InstancedBufferAttribute;
  private readonly instancePhase: THREE.InstancedBufferAttribute;
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

    const geometry = extractStaticColoredGeometry(gltf.scene, new Set(WEAPON_NODE_NAMES));
    groundAlignGeometry(geometry);
    scaleGeometryToHeight(geometry, ENEMY_BASE_HEIGHT);

    const material = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, flatShading: true });
    material.vertexColors = true;

    this.instanceYaw = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.instancePhase = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.instanceYaw.setUsage(THREE.DynamicDrawUsage);

    const yawAttr = instancedBufferAttribute(this.instanceYaw, 'float');
    const phaseAttr = instancedBufferAttribute(this.instancePhase, 'float');
    const tiltDelta = rotate(positionGeometry, vec3(float(TILT_ANGLE), 0, 0)).sub(positionGeometry);
    const tiltDeltaOriented = rotate(tiltDelta, vec3(0, yawAttr, 0));
    const bob = sin(time.mul(BOB_SPEED).add(phaseAttr)).mul(BOB_AMOUNT);
    material.positionNode = positionLocal.add(tiltDeltaOriented).add(vec3(0, bob, 0));

    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    // Park every instance off-screen and invisible until spawned.
    for (let i = 0; i < capacity; i++) {
      DUMMY.position.set(0, -1000, 0);
      DUMMY.scale.setScalar(PARKED_SCALE);
      DUMMY.updateMatrix();
      this.mesh.setMatrixAt(i, DUMMY.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

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

    this.instancePhase.setX(idx, Math.random() * Math.PI * 2);
    this.instancePhase.needsUpdate = true;

    DUMMY.position.set(p.x, 0.5 * p.scale, p.z);
    DUMMY.scale.setScalar(p.scale);
    DUMMY.rotation.set(0, 0, 0);
    DUMMY.updateMatrix();
    this.mesh.setMatrixAt(idx, DUMMY.matrix);
    return idx;
  }

  kill(idx: number): void {
    this.pool.release(idx);
    DUMMY.position.set(0, -1000, 0);
    DUMMY.scale.setScalar(PARKED_SCALE);
    DUMMY.updateMatrix();
    this.mesh.setMatrixAt(idx, DUMMY.matrix);
  }

  /** Clears every live enemy — used when a wave ends so the next attempt doesn't inherit the prior horde. */
  killAll(): void {
    const alive = this.pool.alive;
    let count = this.pool.liveCount;
    while (count > 0) {
      this.kill(alive[count - 1]);
      count = this.pool.liveCount;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Seeks every live enemy toward (targetX, targetZ) — except ranged kinds,
   * which stop at attackRange and fire via onRangedAttack instead — pushes
   * them out of any overlapping obstacle, integrates position, and rebuilds
   * the spatial grid. All scratch state is pre-allocated; no `new` here.
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

      const scale = this.scale[idx];
      const yaw = Math.atan2(dirX, dirZ);
      DUMMY.position.set(this.posX[idx], 0.5 * scale, this.posZ[idx]);
      DUMMY.rotation.y = yaw;
      DUMMY.scale.setScalar(scale);
      DUMMY.updateMatrix();
      this.mesh.setMatrixAt(idx, DUMMY.matrix);
      this.instanceYaw.setX(idx, yaw);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.instanceYaw.needsUpdate = true;
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
