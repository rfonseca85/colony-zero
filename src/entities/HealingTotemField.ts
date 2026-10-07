import * as THREE from 'three/webgpu';
import { ObjectPool } from '@/core/ObjectPool';
import { EnemyField } from '@/entities/EnemyField';
import { resolveEnemyContactDamage } from '@/systems/StructureContactDamage';

const DUMMY = new THREE.Object3D();
const PARKED_SCALE = 0.0001;

export interface HealingTotemSpawnParams {
  x: number;
  z: number;
  hp: number;
  radius: number;
  scale: number;
  healRange: number;
  healRate: number;
}

/**
 * Pooled, instanced healing totems — mint cylinder, no attack. Ticks hp back
 * into the player and any structure within healRange via HealingSystem.
 * Takes contact damage like towers/walls (shared helper), so it can still be
 * destroyed if left undefended.
 */
export class HealingTotemField {
  readonly capacity: number;
  readonly mesh: THREE.InstancedMesh;
  readonly pool: ObjectPool;

  readonly posX: Float32Array;
  readonly posZ: Float32Array;
  readonly hp: Float32Array;
  readonly maxHp: Float32Array;
  readonly radius: Float32Array;
  readonly healRange: Float32Array;
  readonly healRate: Float32Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.pool = new ObjectPool(capacity);

    this.posX = new Float32Array(capacity);
    this.posZ = new Float32Array(capacity);
    this.hp = new Float32Array(capacity);
    this.maxHp = new Float32Array(capacity);
    this.radius = new Float32Array(capacity);
    this.healRange = new Float32Array(capacity);
    this.healRate = new Float32Array(capacity);

    const geometry = new THREE.CylinderGeometry(0.55, 0.65, 1.3, 8);
    const material = new THREE.MeshStandardNodeMaterial({ color: 0x4fe0c0 });
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

  spawn(p: HealingTotemSpawnParams): number {
    const idx = this.pool.acquire();
    if (idx === -1) return -1;
    this.posX[idx] = p.x;
    this.posZ[idx] = p.z;
    this.hp[idx] = p.hp;
    this.maxHp[idx] = p.hp;
    this.radius[idx] = p.radius;
    this.healRange[idx] = p.healRange;
    this.healRate[idx] = p.healRate;

    DUMMY.position.set(p.x, 0.65 * p.scale, p.z);
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

  /** No attack to tick — only takes contact damage; healing tick itself lives in HealingSystem. */
  update(dt: number, enemies: EnemyField, onDestroyed: (x: number, z: number) => void): void {
    resolveEnemyContactDamage(dt, this, enemies, (idx) => this.kill(idx), onDestroyed);
  }
}
