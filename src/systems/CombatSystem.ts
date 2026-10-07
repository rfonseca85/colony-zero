import { EnemyField } from '@/entities/EnemyField';
import { ProjectileField, ProjectileSide } from '@/entities/ProjectileField';
import { Player } from '@/entities/Player';
import { PlayerAimSystem } from '@/systems/PlayerAimSystem';
import { devConfig } from '@/core/DevConfig';

const hitScratch = new Int32Array(64);
const splashScratch = new Int32Array(64);
const PROJECTILE_SPEED = 34;
const PROJECTILE_LIFE = 0.9;
const SPAWN_OFFSET = 0.9; // spawn in front of the player so a shot doesn't instantly collide with whatever's already adjacent to them
const MULTISHOT_SPREAD_RAD = 0.18; // ~10 degrees between pellets, ability-tree unlock

/**
 * Manual mouse-aimed player fire (space bar, direction = cursor's ground
 * position) plus projectile/enemy collision resolution — ally hits on
 * enemies (with optional splash), enemy-fired shots on the player, and
 * enemy melee contact. All per-frame work reads/writes existing typed
 * arrays — no allocation.
 */
export class CombatSystem {
  constructor(
    private player: Player,
    private enemies: EnemyField,
    private projectiles: ProjectileField,
    private aim: PlayerAimSystem,
  ) {}

  update(dt: number, firing: boolean, onEnemyKilled: (x: number, z: number) => void, onPlayerHit: (dmg: number) => void): void {
    this.aimAndFire(firing);
    this.resolveAllyProjectileHits(onEnemyKilled);
    this.resolveEnemyProjectileHits(onPlayerHit);
    this.resolveEnemyContact(dt, onPlayerHit);
  }

  private aimAndFire(firing: boolean): void {
    if (!this.aim.hasAim) return;
    const dx = this.aim.worldX - this.player.x;
    const dz = this.aim.worldZ - this.player.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
    const dirX = dx / dist;
    const dirZ = dz / dist;
    this.player.faceDirection(dirX, dirZ);

    if (!firing) return;
    if (!this.player.tryFire()) return;

    const pellets = this.player.multishotCount;
    const baseAngle = Math.atan2(dirX, dirZ);
    const spreadStart = -((pellets - 1) * MULTISHOT_SPREAD_RAD) / 2;
    for (let p = 0; p < pellets; p++) {
      const angle = baseAngle + spreadStart + p * MULTISHOT_SPREAD_RAD;
      const pdx = Math.sin(angle);
      const pdz = Math.cos(angle);
      this.projectiles.spawn(
        this.player.x + pdx * SPAWN_OFFSET,
        this.player.z + pdz * SPAWN_OFFSET,
        pdx,
        pdz,
        PROJECTILE_SPEED * devConfig.projectileSpeedMult,
        this.player.damage,
        PROJECTILE_LIFE,
        { splash: this.player.explosiveSplash },
      );
    }
  }

  private resolveAllyProjectileHits(onEnemyKilled: (x: number, z: number) => void): void {
    const alive = this.projectiles.pool.alive;
    const count = this.projectiles.pool.liveCount;

    for (let i = count - 1; i >= 0; i--) {
      const pIdx = alive[i];
      if (this.projectiles.side[pIdx] !== ProjectileSide.Ally) continue;
      const px = this.projectiles.posX[pIdx];
      const pz = this.projectiles.posZ[pIdx];
      const hitCount = this.enemies.queryNearby(px, pz, 1.5, hitScratch);

      for (let h = 0; h < hitCount; h++) {
        const eIdx = hitScratch[h];
        const dx = this.enemies.posX[eIdx] - px;
        const dz = this.enemies.posZ[eIdx] - pz;
        const rr = this.enemies.radius[eIdx] + this.projectiles.radius[pIdx];
        if (dx * dx + dz * dz <= rr * rr) {
          const splash = this.projectiles.splash[pIdx];
          if (splash > 0) {
            this.applySplashDamage(px, pz, splash, this.projectiles.damage[pIdx], onEnemyKilled);
          } else {
            this.damageEnemy(eIdx, this.projectiles.damage[pIdx], onEnemyKilled);
          }
          this.projectiles.kill(pIdx);
          break;
        }
      }
    }
  }

  private applySplashDamage(x: number, z: number, radius: number, damage: number, onEnemyKilled: (x: number, z: number) => void): void {
    const count = this.enemies.queryNearby(x, z, radius, splashScratch);
    for (let i = 0; i < count; i++) {
      const eIdx = splashScratch[i];
      const dx = this.enemies.posX[eIdx] - x;
      const dz = this.enemies.posZ[eIdx] - z;
      if (dx * dx + dz * dz <= radius * radius) {
        this.damageEnemy(eIdx, damage, onEnemyKilled);
      }
    }
  }

  private damageEnemy(eIdx: number, damage: number, onEnemyKilled: (x: number, z: number) => void): void {
    this.enemies.hp[eIdx] -= damage;
    if (this.enemies.hp[eIdx] <= 0) {
      onEnemyKilled(this.enemies.posX[eIdx], this.enemies.posZ[eIdx]);
      this.enemies.kill(eIdx);
    }
  }

  private resolveEnemyProjectileHits(onPlayerHit: (dmg: number) => void): void {
    const alive = this.projectiles.pool.alive;
    const count = this.projectiles.pool.liveCount;

    for (let i = count - 1; i >= 0; i--) {
      const pIdx = alive[i];
      if (this.projectiles.side[pIdx] !== ProjectileSide.Enemy) continue;
      const dx = this.player.x - this.projectiles.posX[pIdx];
      const dz = this.player.z - this.projectiles.posZ[pIdx];
      const rr = 0.5 + this.projectiles.radius[pIdx];
      if (dx * dx + dz * dz <= rr * rr) {
        onPlayerHit(this.projectiles.damage[pIdx]);
        this.projectiles.kill(pIdx);
      }
    }
  }

  private resolveEnemyContact(dt: number, onPlayerHit: (dmg: number) => void): void {
    const nearIdx = this.enemies.findNearest(this.player.x, this.player.z, 0.9);
    if (nearIdx === -1) return;
    onPlayerHit(this.enemies.damage[nearIdx] * dt);
  }
}
