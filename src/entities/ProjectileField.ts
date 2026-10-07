import * as THREE from 'three/webgpu';
import { ObjectPool } from '@/core/ObjectPool';

const DUMMY = new THREE.Object3D();
const SCRATCH_COLOR = new THREE.Color();
const PARKED_SCALE = 0.0001;

export const enum ProjectileSide {
  Ally = 0, // player + structures
  Enemy = 1,
}

const SIDE_COLOR: Record<ProjectileSide, number> = {
  [ProjectileSide.Ally]: 0xffe066,
  [ProjectileSide.Enemy]: 0xff4d4d,
};

export interface ProjectileSpawnOptions {
  radius?: number;
  side?: ProjectileSide;
  /** >0 makes this a splash shell — CombatSystem damages every enemy within this radius of the impact, not just the one hit. */
  splash?: number;
}

/**
 * Pooled, instanced projectiles (spheres per Plan.md, colored per side so
 * enemy fire reads as a threat to dodge). Same SoA + InstancedMesh pattern
 * as EnemyField, sized for ranged-attack volume rather than enemy-count volume.
 */
export class ProjectileField {
  readonly capacity: number;
  readonly mesh: THREE.InstancedMesh;
  readonly pool: ObjectPool;

  readonly posX: Float32Array;
  readonly posZ: Float32Array;
  readonly velX: Float32Array;
  readonly velZ: Float32Array;
  readonly damage: Float32Array;
  readonly life: Float32Array; // seconds remaining
  readonly radius: Float32Array;
  readonly side: Uint8Array;
  readonly splash: Float32Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.pool = new ObjectPool(capacity);

    this.posX = new Float32Array(capacity);
    this.posZ = new Float32Array(capacity);
    this.velX = new Float32Array(capacity);
    this.velZ = new Float32Array(capacity);
    this.damage = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.radius = new Float32Array(capacity);
    this.side = new Uint8Array(capacity);
    this.splash = new Float32Array(capacity);

    const geometry = new THREE.SphereGeometry(0.18, 8, 6);
    const material = new THREE.MeshBasicNodeMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);

    for (let i = 0; i < capacity; i++) {
      DUMMY.position.set(0, -1000, 0);
      DUMMY.scale.setScalar(PARKED_SCALE);
      DUMMY.updateMatrix();
      this.mesh.setMatrixAt(i, DUMMY.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  spawn(x: number, z: number, dirX: number, dirZ: number, speed: number, damage: number, lifeSeconds: number, opts: ProjectileSpawnOptions = {}): number {
    const idx = this.pool.acquire();
    if (idx === -1) return -1;
    const side = opts.side ?? ProjectileSide.Ally;
    this.posX[idx] = x;
    this.posZ[idx] = z;
    this.velX[idx] = dirX * speed;
    this.velZ[idx] = dirZ * speed;
    this.damage[idx] = damage;
    this.life[idx] = lifeSeconds;
    this.radius[idx] = opts.radius ?? 0.3;
    this.side[idx] = side;
    this.splash[idx] = opts.splash ?? 0;

    this.mesh.setColorAt(idx, SCRATCH_COLOR.setHex(SIDE_COLOR[side]));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return idx;
  }

  kill(idx: number): void {
    this.pool.release(idx);
    DUMMY.position.set(0, -1000, 0);
    DUMMY.scale.setScalar(PARKED_SCALE);
    DUMMY.updateMatrix();
    this.mesh.setMatrixAt(idx, DUMMY.matrix);
  }

  /** Clears every live projectile — used on wave reset alongside EnemyField.killAll(). */
  killAll(): void {
    const alive = this.pool.alive;
    let count = this.pool.liveCount;
    while (count > 0) {
      this.kill(alive[count - 1]);
      count = this.pool.liveCount;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number): void {
    const alive = this.pool.alive;
    const count = this.pool.liveCount;

    // Iterate backwards so releasing (which swaps in the last alive index)
    // never skips an entry we haven't processed yet.
    for (let i = count - 1; i >= 0; i--) {
      const idx = alive[i];
      this.life[idx] -= dt;
      if (this.life[idx] <= 0) {
        this.kill(idx);
        continue;
      }
      this.posX[idx] += this.velX[idx] * dt;
      this.posZ[idx] += this.velZ[idx] * dt;

      DUMMY.position.set(this.posX[idx], 0.5, this.posZ[idx]);
      DUMMY.scale.setScalar(1); // reset from PARKED_SCALE — a dead slot's leftover scale must not leak onto the next live projectile
      DUMMY.updateMatrix();
      this.mesh.setMatrixAt(idx, DUMMY.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
