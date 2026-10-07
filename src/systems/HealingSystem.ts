import { HealingTotemField } from '@/entities/HealingTotemField';
import { Player } from '@/entities/Player';

export interface HealableField {
  pool: { alive: Int32Array; liveCount: number };
  posX: Float32Array;
  posZ: Float32Array;
  hp: Float32Array;
  maxHp: Float32Array;
}

/**
 * Generic heal-over-time tick: every live totem heals the player and any
 * instance of any registered HealableField within healRange, clamped to
 * maxHp. Works against the shared {pool,posX,posZ,hp,maxHp} shape so new
 * structure types just get added to `fields` — no per-field branching.
 */
export class HealingSystem {
  constructor(
    private totems: HealingTotemField,
    private player: Player,
    private fields: readonly HealableField[],
  ) {}

  update(dt: number): void {
    const alive = this.totems.pool.alive;
    const count = this.totems.pool.liveCount;

    for (let i = 0; i < count; i++) {
      const tIdx = alive[i];
      const tx = this.totems.posX[tIdx];
      const tz = this.totems.posZ[tIdx];
      const range = this.totems.healRange[tIdx];
      const amount = this.totems.healRate[tIdx] * dt;

      this.healPlayer(tx, tz, range, amount);
      for (const field of this.fields) this.healField(field, tx, tz, range, amount);
    }
  }

  private healPlayer(tx: number, tz: number, range: number, amount: number): void {
    const dx = this.player.x - tx;
    const dz = this.player.z - tz;
    if (dx * dx + dz * dz > range * range) return;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount);
  }

  private healField(field: HealableField, tx: number, tz: number, range: number, amount: number): void {
    const alive = field.pool.alive;
    const count = field.pool.liveCount;
    for (let i = 0; i < count; i++) {
      const idx = alive[i];
      const dx = field.posX[idx] - tx;
      const dz = field.posZ[idx] - tz;
      if (dx * dx + dz * dz > range * range) continue;
      field.hp[idx] = Math.min(field.maxHp[idx], field.hp[idx] + amount);
    }
  }
}
