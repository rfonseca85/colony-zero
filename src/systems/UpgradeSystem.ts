import { Player } from '@/entities/Player';
import { devConfig } from '@/core/DevConfig';

const SAVE_KEY = 'colonyzero.save.v1';

/** Matches Player's own defaults; upgrades scale from these, never from the live (already-scaled) field. */
const BASE_STATS = {
  damage: 8,
  speed: 8,
  maxHp: 100,
  fireCooldown: 0.35,
};

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  /** Sets an absolute stat on the player from BASE_STATS * level, so repeated calls never compound. */
  apply(player: Player, level: number): void;
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: 'damage',
    name: '+10% Player Damage',
    description: 'Increases projectile damage per level.',
    baseCost: 20,
    costGrowth: 1.6,
    maxLevel: 5,
    apply: (player, level) => {
      player.damage = BASE_STATS.damage * (1 + 0.1 * level);
    },
  },
  {
    id: 'speed',
    name: '+15% Move Speed',
    description: 'Increases movement speed per level.',
    baseCost: 15,
    costGrowth: 1.6,
    maxLevel: 5,
    apply: (player, level) => {
      player.speed = BASE_STATS.speed * (1 + 0.15 * level);
    },
  },
  {
    id: 'maxhp',
    name: '+20% Max HP',
    description: 'Increases max health per level.',
    baseCost: 25,
    costGrowth: 1.6,
    maxLevel: 5,
    apply: (player, level) => {
      player.maxHp = BASE_STATS.maxHp * (1 + 0.2 * level);
    },
  },
  {
    id: 'firerate',
    name: '+10% Fire Rate',
    description: 'Reduces time between shots per level.',
    baseCost: 20,
    costGrowth: 1.6,
    maxLevel: 5,
    apply: (player, level) => {
      player.fireCooldown = BASE_STATS.fireCooldown / (1 + 0.1 * level);
    },
  },
];

interface SaveBlob {
  currency: number;
  levels: Record<string, number>;
}

/**
 * Owns persistent currency + purchased upgrade levels. Survives death
 * (in-memory) and page reload (localStorage) per Plan.md's "retained
 * currency" Resolution-phase description.
 */
export class UpgradeSystem {
  currency = 0;
  private levels: Record<string, number> = {};

  constructor() {
    this.load();
  }

  getLevel(id: string): number {
    return this.levels[id] ?? 0;
  }

  getCost(id: string): number {
    const def = UPGRADE_DEFS.find((d) => d.id === id);
    if (!def) return Infinity;
    const level = this.getLevel(id);
    if (level >= def.maxLevel) return Infinity;
    return Math.round(def.baseCost * Math.pow(def.costGrowth, level));
  }

  canAfford(id: string): boolean {
    if (devConfig.infiniteMoney) return true;
    return this.currency >= this.getCost(id);
  }

  purchase(id: string): boolean {
    const cost = this.getCost(id);
    if (!Number.isFinite(cost)) return false;
    if (!devConfig.infiniteMoney) {
      if (this.currency < cost) return false;
      this.currency -= cost;
    }
    this.levels[id] = this.getLevel(id) + 1;
    this.save();
    return true;
  }

  addCurrency(amount: number): void {
    this.currency += amount;
    this.save();
  }

  /** Generic spend for costs outside the upgrade tree (e.g. structure placement). Dev mode's infinite-money skips the deduction. */
  spendCurrency(amount: number): boolean {
    if (devConfig.infiniteMoney) return true;
    if (this.currency < amount) return false;
    this.currency -= amount;
    this.save();
    return true;
  }

  /** Recomputes every upgraded stat from base — call once per wave start, never mid-wave. */
  applyAll(player: Player): void {
    for (const def of UPGRADE_DEFS) {
      def.apply(player, this.getLevel(def.id));
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const blob = JSON.parse(raw) as SaveBlob;
      this.currency = blob.currency ?? 0;
      this.levels = blob.levels ?? {};
    } catch {
      // Corrupt/unavailable storage falls back to a fresh save.
    }
  }

  private save(): void {
    const blob: SaveBlob = { currency: this.currency, levels: this.levels };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
    } catch {
      // Storage can be unavailable (private mode, quota); progress just won't persist.
    }
  }
}
