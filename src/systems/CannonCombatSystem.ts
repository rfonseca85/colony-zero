import { EnemyField } from '@/entities/EnemyField';
import { ProjectileField } from '@/entities/ProjectileField';
import { CannonField } from '@/entities/CannonField';
import { resolveEnemyContactDamage } from '@/systems/StructureContactDamage';
import { devConfig } from '@/core/DevConfig';

/**
 * Cannon auto-fire (nearest enemy, same pattern as TowerCombatSystem) plus
 * enemy-contact damage against cannons. Shots carry splash so CombatSystem's
 * existing applySplashDamage covers clustered hits without any changes there.
 */
export class CannonCombatSystem {
  constructor(
    private cannons: CannonField,
    private enemies: EnemyField,
    private projectiles: ProjectileField,
  ) {}

  update(dt: number, onCannonDestroyed: (x: number, z: number) => void): void {
    this.cannons.update(dt);
    this.autoFire();
    resolveEnemyContactDamage(dt, this.cannons, this.enemies, (idx) => this.cannons.kill(idx), onCannonDestroyed);
  }

  private autoFire(): void {
    const alive = this.cannons.pool.alive;
    const count = this.cannons.pool.liveCount;

    for (let i = 0; i < count; i++) {
      const cIdx = alive[i];
      const cx = this.cannons.posX[cIdx];
      const cz = this.cannons.posZ[cIdx];
      const targetIdx = this.enemies.findNearest(cx, cz, this.cannons.fireRange[cIdx]);
      if (targetIdx === -1) continue;
      if (!this.cannons.tryFire(cIdx)) continue;

      const dx = this.enemies.posX[targetIdx] - cx;
      const dz = this.enemies.posZ[targetIdx] - cz;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      this.projectiles.spawn(cx, cz, dx / dist, dz / dist, 22 * devConfig.projectileSpeedMult, this.cannons.damage[cIdx], 1.4, {
        splash: this.cannons.splash[cIdx],
      });
    }
  }
}
