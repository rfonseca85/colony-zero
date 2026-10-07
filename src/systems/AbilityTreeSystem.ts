import { Player } from '@/entities/Player';

const SAVE_KEY = 'colonyzero.abilities.v1';

export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** Prereq node id, if any — must be unlocked before this one is purchasable. */
  requires?: string;
}

export const ABILITY_DEFS: AbilityDef[] = [
  {
    id: 'multishot',
    name: 'Multishot',
    description: 'Fire 2 pellets per shot instead of 1.',
    cost: 60,
  },
  {
    id: 'explosive',
    name: 'Explosive Rounds',
    description: 'Player shots splash nearby enemies.',
    cost: 90,
    requires: 'multishot',
  },
  {
    id: 'secondwind',
    name: 'Second Wind',
    description: 'Survive a lethal hit once per run at 30% HP.',
    cost: 80,
  },
];

interface SaveBlob {
  unlocked: Record<string, boolean>;
}

/**
 * Permanent ability-tree unlocks, separate save slot from UpgradeSystem's
 * currency/levels blob so neither system can clobber the other's data.
 * Spends through the UpgradeSystem instance since currency is shared.
 */
export class AbilityTreeSystem {
  private unlocked: Record<string, boolean> = {};

  constructor() {
    this.load();
  }

  isUnlocked(id: string): boolean {
    return this.unlocked[id] === true;
  }

  canUnlock(id: string, currency: number): boolean {
    const def = ABILITY_DEFS.find((d) => d.id === id);
    if (!def) return false;
    if (this.isUnlocked(id)) return false;
    if (def.requires && !this.isUnlocked(def.requires)) return false;
    return currency >= def.cost;
  }

  /** Caller supplies spend(cost) — kept decoupled from UpgradeSystem's class to avoid an import cycle risk. */
  unlock(id: string, spend: (cost: number) => boolean): boolean {
    const def = ABILITY_DEFS.find((d) => d.id === id);
    if (!def) return false;
    if (this.isUnlocked(id)) return false;
    if (def.requires && !this.isUnlocked(def.requires)) return false;
    if (!spend(def.cost)) return false;
    this.unlocked[id] = true;
    this.save();
    return true;
  }

  /** Recomputes every ability-gated stat from unlock state — call once per Planning->Action transition, never mid-wave. */
  applyAll(player: Player): void {
    player.multishotCount = this.isUnlocked('multishot') ? 2 : 1;
    player.explosiveSplash = this.isUnlocked('explosive') ? 1.5 : 0;
    player.secondWindAvailable = this.isUnlocked('secondwind');
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const blob = JSON.parse(raw) as SaveBlob;
      this.unlocked = blob.unlocked ?? {};
    } catch {
      // Corrupt/unavailable storage falls back to a fresh save.
    }
  }

  private save(): void {
    const blob: SaveBlob = { unlocked: this.unlocked };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
    } catch {
      // Storage can be unavailable (private mode, quota); progress just won't persist.
    }
  }
}
