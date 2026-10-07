import { Player } from '@/entities/Player';

export interface PerkDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** Multiplies/adds onto the stat player already has after upgrades+abilities applyAll — never recomputes a base. */
  apply(player: Player): void;
}

export const PERK_DEFS: PerkDef[] = [
  {
    id: 'adrenaline',
    name: 'Adrenaline',
    description: '+20% fire rate this run.',
    cost: 40,
    apply: (player) => {
      player.fireCooldown /= 1.2;
    },
  },
  {
    id: 'ironskin',
    name: 'Iron Skin',
    description: '+25% max HP this run.',
    cost: 40,
    apply: (player) => {
      player.maxHp *= 1.25;
    },
  },
  {
    id: 'overcharge',
    name: 'Overcharge',
    description: '+25% damage this run.',
    cost: 50,
    apply: (player) => {
      player.damage *= 1.25;
    },
  },
  {
    id: 'swiftboots',
    name: 'Swift Boots',
    description: '+20% move speed this run.',
    cost: 30,
    apply: (player) => {
      player.speed *= 1.2;
    },
  },
];

/**
 * Run-only perks bought during Planning with the same persistent currency
 * (spent for good) but whose stat effect only lasts the current run.
 * Purchases are tracked here, not persisted, and reset on RETURN_TO_HUB.
 * applyAll must run AFTER UpgradeSystem.applyAll/AbilityTreeSystem.applyAll
 * each Planning->Action transition since this layers a multiplier on top of
 * their already-recomputed base — PerkSystem doesn't own the player's base
 * stats, so it can't safely recompute from scratch itself.
 */
export class PerkSystem {
  private purchased: Set<string> = new Set();

  constructor(private spend: (cost: number) => boolean) {}

  isPurchased(id: string): boolean {
    return this.purchased.has(id);
  }

  buy(id: string): boolean {
    if (this.purchased.has(id)) return false;
    const def = PERK_DEFS.find((d) => d.id === id);
    if (!def) return false;
    if (!this.spend(def.cost)) return false;
    this.purchased.add(id);
    return true;
  }

  /** Applies every purchased perk once, on top of the caller's already-recomputed base stats. */
  applyAll(player: Player): void {
    for (const def of PERK_DEFS) {
      if (this.purchased.has(def.id)) def.apply(player);
    }
  }

  /** Purchases are run-only — wipe on RETURN_TO_HUB regardless of win/lose; currency already spent stays spent. */
  resetRun(): void {
    this.purchased.clear();
  }
}
