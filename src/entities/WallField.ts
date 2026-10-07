import * as THREE from 'three/webgpu';
import { ObjectPool } from '@/core/ObjectPool';
import { EnemyField } from '@/entities/EnemyField';
import { resolveEnemyContactDamage } from '@/systems/StructureContactDamage';

const DUMMY = new THREE.Object3D();
const PARKED_SCALE = 0.0001;

export interface WallSpawnParams {
  x: number;
  z: number;
  hp: number;
  radius: number;
  scale: number;
}

/**
 * Pooled, instanced walls — pure obstacles, no attack. Grey BoxGeometry per
 * Plan.md's primitive-only rule. Same SoA + InstancedMesh + ObjectPool
 * pattern as TowerField; only takes contact damage, never fires.
 */
export class WallField {
  readonly capacity: number;
  readonly mesh: THREE.InstancedMesh;
  readonly pool: ObjectPool;

  readonly posX: Float32Array;
  readonly posZ: Float32Array;
  readonly hp: Float32Array;
  readonly maxHp: Float32Array;
  readonly radius: Float32Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.pool = new ObjectPool(capacity);

    this.posX = new Float32Array(capacity);
    this.posZ = new Float32Array(capacity);
    this.hp = new Float32Array(capacity);
    this.maxHp = new Float32Array(capacity);
    this.radius = new Float32Array(capacity);

    const geometry = new THREE.BoxGeometry(1.1, 1.1, 1.1);
    const material = new THREE.MeshStandardNodeMaterial({ color: 0x8a8f8c });
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

  spawn(p: WallSpawnParams): number {
    const idx = this.pool.acquire();
    if (idx === -1) return -1;
    this.posX[idx] = p.x;
    this.posZ[idx] = p.z;
    this.hp[idx] = p.hp;
    this.maxHp[idx] = p.hp;
    this.radius[idx] = p.radius;

    DUMMY.position.set(p.x, 0.55 * p.scale, p.z);
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

  /** No attack to tick — only takes contact damage from adjacent enemies, via the shared structure-damage helper. */
  update(dt: number, enemies: EnemyField, onDestroyed: (x: number, z: number) => void): void {
    resolveEnemyContactDamage(dt, this, enemies, (idx) => this.kill(idx), onDestroyed);
  }
}
