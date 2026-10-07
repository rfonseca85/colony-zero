export interface DevConfigData {
  infiniteMoney: boolean;
  godMode: boolean;
  timeScale: number;

  playerDamageMult: number;
  playerSpeedMult: number;
  playerFireRateMult: number; // >1 fires faster (divides cooldown)

  enemyHpMult: number;
  enemySpeedMult: number;
  enemyDamageMult: number;
  enemySpawnRateMult: number; // >1 spawns faster
  /** null = the spawner's normal wave-scaled odds; 0-1 pins the odds outright, useful for isolating one enemy kind. */
  eliteChanceOverride: number | null;
  rangedChanceOverride: number | null;
  /** 0 = unlimited (spawner only gated by its own timer). */
  maxConcurrentEnemies: number;

  projectileSpeedMult: number;
  waveDurationSeconds: number;
}

export const DEV_CONFIG_DEFAULTS: DevConfigData = {
  infiniteMoney: false,
  godMode: false,
  timeScale: 1,

  playerDamageMult: 1,
  playerSpeedMult: 1,
  playerFireRateMult: 1,

  enemyHpMult: 1,
  enemySpeedMult: 1,
  enemyDamageMult: 1,
  enemySpawnRateMult: 1,
  eliteChanceOverride: null,
  rangedChanceOverride: null,
  maxConcurrentEnemies: 0,

  projectileSpeedMult: 1,
  waveDurationSeconds: 90,
};

type Listener = () => void;

/**
 * Single global source of truth for every dev/testing knob. Plain systems
 * (EnemySpawner, CombatSystem, ...) read `devConfig.<field>` directly rather
 * than taking it as a constructor dependency, since it's meant to be
 * tweakable from a panel at any time without re-wiring the game's object
 * graph. Not part of the zero-GC per-frame path — this is read, not
 * allocated, every frame.
 */
class DevConfig implements DevConfigData {
  infiniteMoney = DEV_CONFIG_DEFAULTS.infiniteMoney;
  godMode = DEV_CONFIG_DEFAULTS.godMode;
  timeScale = DEV_CONFIG_DEFAULTS.timeScale;
  playerDamageMult = DEV_CONFIG_DEFAULTS.playerDamageMult;
  playerSpeedMult = DEV_CONFIG_DEFAULTS.playerSpeedMult;
  playerFireRateMult = DEV_CONFIG_DEFAULTS.playerFireRateMult;
  enemyHpMult = DEV_CONFIG_DEFAULTS.enemyHpMult;
  enemySpeedMult = DEV_CONFIG_DEFAULTS.enemySpeedMult;
  enemyDamageMult = DEV_CONFIG_DEFAULTS.enemyDamageMult;
  enemySpawnRateMult = DEV_CONFIG_DEFAULTS.enemySpawnRateMult;
  eliteChanceOverride = DEV_CONFIG_DEFAULTS.eliteChanceOverride;
  rangedChanceOverride = DEV_CONFIG_DEFAULTS.rangedChanceOverride;
  maxConcurrentEnemies = DEV_CONFIG_DEFAULTS.maxConcurrentEnemies;
  projectileSpeedMult = DEV_CONFIG_DEFAULTS.projectileSpeedMult;
  waveDurationSeconds = DEV_CONFIG_DEFAULTS.waveDurationSeconds;

  private listeners: Listener[] = [];

  onChange(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i !== -1) this.listeners.splice(i, 1);
    };
  }

  /** Call after mutating any field directly so the panel/dependent systems can react. */
  notify(): void {
    for (const l of this.listeners) l();
  }

  reset(): void {
    Object.assign(this, DEV_CONFIG_DEFAULTS);
    this.notify();
  }
}

export const devConfig = new DevConfig();
