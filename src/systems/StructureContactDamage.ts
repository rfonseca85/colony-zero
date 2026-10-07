import { EnemyField } from '@/entities/EnemyField';

export interface ContactDamageTarget {
  pool: { alive: Int32Array; liveCount: number };
  posX: Float32Array;
  posZ: Float32Array;
  radius: Float32Array;
  hp: Float32Array;
}

/**
 * Shared enemy-contact damage resolution for any structure field (towers,
 * walls, cannons, healing totems, ...) so each field/combat-system doesn't
 * reimplement the same "find nearest adjacent enemy, drain hp, kill at 0"
 * loop. Iterates backwards since kill() swaps the last alive index into the
 * current slot.
 */
export function resolveEnemyContactDamage(
  dt: number,
  field: ContactDamageTarget,
  enemies: EnemyField,
  kill: (idx: number) => void,
  onDestroyed: (x: number, z: number) => void,
  touchPad = 0.8,
): void {
  const alive = field.pool.alive;
  const count = field.pool.liveCount;

  for (let i = count - 1; i >= 0; i--) {
    const idx = alive[i];
    const x = field.posX[idx];
    const z = field.posZ[idx];
    const nearIdx = enemies.findNearest(x, z, field.radius[idx] + touchPad);
    if (nearIdx === -1) continue;

    field.hp[idx] -= enemies.damage[nearIdx] * dt;
    if (field.hp[idx] <= 0) {
      onDestroyed(x, z);
      kill(idx);
    }
  }
}
