import { EnemyField } from '@/entities/EnemyField';
import { ProjectileField } from '@/entities/ProjectileField';
import { TowerField } from '@/entities/TowerField';
import { resolveEnemyContactDamage } from '@/systems/StructureContactDamage';
import { devConfig } from '@/core/DevConfig';

/**
 * Tower auto-fire (nearest enemy via EnemyField's spatial grid) plus
 * enemy-contact damage against towers. Fired projectiles land in the same
 * shared ProjectileField the player uses, so CombatSystem's existing
 * projectile/enemy hit resolution already covers them — no duplication.
 */
export class TowerCombatSystem {
  constructor(
    private towers: TowerField,
    private enemies: EnemyField,
    private projectiles: ProjectileField,
  ) {}

  update(dt: number, onTowerDestroyed: (x: number, z: number) => void): void {
    this.towers.update(dt);
    this.autoFire();
    this.resolveEnemyContact(dt, onTowerDestroyed);
  }

  private autoFire(): void {
    const alive = this.towers.pool.alive;
    const count = this.towers.pool.liveCount;

    for (let i = 0; i < count; i++) {
      const tIdx = alive[i];
      const tx = this.towers.posX[tIdx];
      const tz = this.towers.posZ[tIdx];
      const targetIdx = this.enemies.findNearest(tx, tz, this.towers.fireRange[tIdx]);
      if (targetIdx === -1) continue;
      if (!this.towers.tryFire(tIdx)) continue;

      const dx = this.enemies.posX[targetIdx] - tx;
      const dz = this.enemies.posZ[targetIdx] - tz;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      this.projectiles.spawn(tx, tz, dx / dist, dz / dist, 26 * devConfig.projectileSpeedMult, this.towers.damage[tIdx], 1.1);
    }
  }

  private resolveEnemyContact(dt: number, onTowerDestroyed: (x: number, z: number) => void): void {
    resolveEnemyContactDamage(dt, this.towers, this.enemies, (idx) => this.towers.kill(idx), onTowerDestroyed);
  }
}
