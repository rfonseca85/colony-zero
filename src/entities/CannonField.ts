import * as THREE from 'three/webgpu';
import { ObjectPool } from '@/core/ObjectPool';

const DUMMY = new THREE.Object3D();
const PARKED_SCALE = 0.0001;

export interface CannonSpawnParams {
  x: number;
  z: number;
  hp: number;
  radius: number;
  scale: number;
  fireRange: number;
  fireCooldown: number;
  damage: number;
  splash: number;
}

/**
 * Pooled, instanced cannons — slower-firing, higher-damage splash-AOE tower
 * variant. Orange/rust cylinder, bigger silhouette than TowerField. Same SoA
 * + InstancedMesh + ObjectPool pattern; fires into the shared ProjectileField
 * with splash set, so CombatSystem's existing splash resolution covers hits.
 */
export class CannonField {
  readonly capacity: number;
  readonly mesh: THREE.InstancedMesh;
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
  readonly splash: Float32Array;

  constructor(capacity: number) {
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
    this.splash = new Float32Array(capacity);

    const geometry = new THREE.CylinderGeometry(0.9, 0.9, 2.1, 12);
    const material = new THREE.MeshStandardNodeMaterial({ color: 0xdc8f3f });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    for (let i = 0; i < capacity; i++) {
      DUMMY.position.set(0, -1000, 0);
      DUMMY.scale.setScalar(PARKED_SCALE);
      DUMMY.updateMatrix();
      this.mesh.setMatrixAt(i, DUMMY.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  spawn(p: CannonSpawnParams): number {
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
    this.splash[idx] = p.splash;

    DUMMY.position.set(p.x, 1.05 * p.scale, p.z);
    DUMMY.scale.setScalar(p.scale);
    DUMMY.rotation.set(0, 0, 0);
    DUMMY.updateMatrix();
    this.mesh.setMatrixAt(idx, DUMMY.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    return idx;
  }

  kill(idx: number): void {
    this.pool.release(idx);
    DUMMY.position.set(0, -1000, 0);
    DUMMY.scale.setScalar(PARKED_SCALE);
    DUMMY.updateMatrix();
    this.mesh.setMatrixAt(idx, DUMMY.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  killAll(): void {
    const alive = this.pool.alive;
    let count = this.pool.liveCount;
    while (count > 0) {
      this.kill(alive[count - 1]);
      count = this.pool.liveCount;
    }
  }

  update(dt: number): void {
    const alive = this.pool.alive;
    const count = this.pool.liveCount;
    for (let i = 0; i < count; i++) {
      const idx = alive[i];
      if (this.fireTimer[idx] > 0) this.fireTimer[idx] -= dt;
    }
  }

  tryFire(idx: number): boolean {
    if (this.fireTimer[idx] > 0) return false;
    this.fireTimer[idx] = this.fireCooldown[idx];
    return true;
  }
}
