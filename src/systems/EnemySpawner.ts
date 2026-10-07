import { EnemyField, EnemyKind } from '@/entities/EnemyField';
import { devConfig } from '@/core/DevConfig';

/**
 * Timed ring-spawner: enemies appear just outside the camera's visible
 * radius and walk inward (handled by EnemyField.update's seek behavior).
 * Picks a kind per spawn — basic always available, elite/ranged unlock
 * (via rising odds) as waveStrength grows, so early waves stay simple.
 * Every tunable here can be overridden live via devConfig for testing.
 */
export class EnemySpawner {
  private timer = 0;
  /** Seconds between spawns at wave start; ramps down (faster spawns) as waveStrength grows, floored so it never becomes unfair. */
  baseInterval = 0.9;
  minInterval = 0.35;
  spawnRadius = 26;
  enabled = true;

  constructor(private field: EnemyField) {}

  update(dt: number, originX: number, originZ: number, waveStrength: number): void {
    if (!this.enabled) return;
    if (devConfig.maxConcurrentEnemies > 0 && this.field.pool.liveCount >= devConfig.maxConcurrentEnemies) return;

    const interval = Math.max(this.minInterval, this.baseInterval - waveStrength * 0.02) / devConfig.enemySpawnRateMult;
    this.timer -= dt;
    while (this.timer <= 0) {
      this.timer += interval;
      this.spawnOne(originX, originZ, waveStrength);
      if (devConfig.maxConcurrentEnemies > 0 && this.field.pool.liveCount >= devConfig.maxConcurrentEnemies) break;
    }
  }

  private spawnOne(originX: number, originZ: number, waveStrength: number): void {
    const angle = Math.random() * Math.PI * 2;
    const x = originX + Math.cos(angle) * this.spawnRadius;
    const z = originZ + Math.sin(angle) * this.spawnRadius;
    const kind = this.rollKind(waveStrength);
    const hpMult = devConfig.enemyHpMult;
    const speedMult = devConfig.enemySpeedMult;
    const dmgMult = devConfig.enemyDamageMult;

    if (kind === EnemyKind.Elite) {
      this.field.spawn({
        x,
        z,
        hp: (8 + waveStrength) * 3.5 * hpMult,
        speed: (1.0 + Math.random() * 0.5) * speedMult,
        radius: 0.8,
        scale: 1.6 + Math.random() * 0.4,
        damage: 12 * dmgMult,
        kind,
      });
    } else if (kind === EnemyKind.Ranged) {
      this.field.spawn({
        x,
        z,
        hp: (8 + waveStrength) * 0.8 * hpMult,
        speed: (1.2 + Math.random() * 0.6) * speedMult,
        radius: 0.45,
        scale: 0.8 + Math.random() * 0.2,
        damage: 3 * dmgMult,
        kind,
        attackRange: 8,
        attackCooldown: 1.4,
      });
    } else {
      this.field.spawn({
        x,
        z,
        hp: (8 + waveStrength) * hpMult,
        speed: (1.5 + Math.random() * 1.2) * speedMult,
        radius: 0.5,
        scale: 0.8 + Math.random() * 0.6,
        damage: 5 * dmgMult,
        kind,
      });
    }
  }

  private rollKind(waveStrength: number): EnemyKind {
    const eliteChance = devConfig.eliteChanceOverride ?? Math.min(0.25, 0.04 + waveStrength * 0.004);
    const rangedChance = devConfig.rangedChanceOverride ?? Math.min(0.3, 0.08 + waveStrength * 0.004);
    const roll = Math.random();
    if (roll < eliteChance) return EnemyKind.Elite;
    if (roll < eliteChance + rangedChance) return EnemyKind.Ranged;
    return EnemyKind.Basic;
  }

  /** Burst-spawns a fixed count immediately, scattered around origin — used for perf testing and the dev panel's stress-test button. */
  burst(count: number, originX: number, originZ: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 4 + Math.random() * this.spawnRadius;
      this.field.spawn({
        x: originX + Math.cos(angle) * dist,
        z: originZ + Math.sin(angle) * dist,
        hp: 10 * devConfig.enemyHpMult,
        speed: (1.5 + Math.random() * 1.2) * devConfig.enemySpeedMult,
        radius: 0.5,
        scale: 0.8 + Math.random() * 0.6,
        damage: 5 * devConfig.enemyDamageMult,
        kind: EnemyKind.Basic,
      });
    }
  }
}
