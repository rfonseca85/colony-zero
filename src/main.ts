import { SceneRig } from '@/core/SceneRig';
import { Clock } from '@/core/Clock';
import { InputManager } from '@/core/InputManager';
import { GauntletStateMachine, GauntletState } from '@/core/GauntletStateMachine';
import { ObstacleBuffer } from '@/core/ObstacleBuffer';
import { StructureRegistry } from '@/core/StructureRegistry';
import { EnemyField } from '@/entities/EnemyField';
import { ProjectileField, ProjectileSide } from '@/entities/ProjectileField';
import { Player } from '@/entities/Player';
import { TowerField } from '@/entities/TowerField';
import { WallField } from '@/entities/WallField';
import { HealingTotemField } from '@/entities/HealingTotemField';
import { CannonField } from '@/entities/CannonField';
import { createGround } from '@/entities/Ground';
import { EnemySpawner } from '@/systems/EnemySpawner';
import { CombatSystem } from '@/systems/CombatSystem';
import { TowerCombatSystem } from '@/systems/TowerCombatSystem';
import { CannonCombatSystem } from '@/systems/CannonCombatSystem';
import { HealingSystem } from '@/systems/HealingSystem';
import { StructurePlacementSystem, StructureDef, StructureKind } from '@/systems/StructurePlacementSystem';
import { PlayerAimSystem } from '@/systems/PlayerAimSystem';
import { UpgradeSystem } from '@/systems/UpgradeSystem';
import { AbilityTreeSystem } from '@/systems/AbilityTreeSystem';
import { PerkSystem } from '@/systems/PerkSystem';
import { PerfHud } from '@/ui/PerfHud';
import { HubOverlay } from '@/ui/HubOverlay';
import { HealthBarOverlay } from '@/ui/HealthBarOverlay';
import { PlanningOverlay } from '@/ui/PlanningOverlay';
import { PerkShopOverlay } from '@/ui/PerkShopOverlay';
import { ResolutionOverlay } from '@/ui/ResolutionOverlay';
import { WaveTimerBar } from '@/ui/WaveTimerBar';
import { DevPanel } from '@/ui/DevPanel';
import { devConfig } from '@/core/DevConfig';
import { AssetManager, MODEL_URLS } from '@/core/AssetManager';
import { scatterEnvironment, ENV_MODEL_URLS } from '@/entities/EnvironmentDecor';

const ENEMY_CAPACITY = 4000;
const PROJECTILE_CAPACITY = 2000;
const TOWER_CAPACITY = 64;
const WALL_CAPACITY = 64;
const HEALING_TOTEM_CAPACITY = 16;
const CANNON_CAPACITY = 32;
const OBSTACLE_CAPACITY = 256; // towers + walls + healing totems + cannons, combined
const WORLD_SIZE = 200;

async function main(): Promise<void> {
  const container = document.getElementById('app')!;
  const rig = new SceneRig(container);
  await rig.init();

  const loadingEl = document.createElement('div');
  loadingEl.textContent = 'Loading assets…';
  loadingEl.style.cssText = `
    position: absolute; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center;
    background: #0b0f0d; color: #6ee7a0; font: 14px 'SF Mono', Menlo, monospace; letter-spacing: 0.08em;
  `;
  container.appendChild(loadingEl);
  await AssetManager.preload([...Object.values(MODEL_URLS), ...Object.values(ENV_MODEL_URLS)]);
  loadingEl.remove();

  const ground = createGround(WORLD_SIZE);
  rig.scene.add(ground);
  scatterEnvironment(rig.scene);

  const player = new Player(AssetManager.get(MODEL_URLS.soldier));
  rig.scene.add(player.mesh);

  const enemies = new EnemyField(ENEMY_CAPACITY, WORLD_SIZE, AssetManager.get(MODEL_URLS.enemy));
  rig.scene.add(enemies.mesh);

  const projectiles = new ProjectileField(PROJECTILE_CAPACITY);
  rig.scene.add(projectiles.mesh);

  const towers = new TowerField(TOWER_CAPACITY, AssetManager.get(MODEL_URLS.hazmat));
  rig.scene.add(towers.root);

  const walls = new WallField(WALL_CAPACITY);
  rig.scene.add(walls.mesh);

  const healingTotems = new HealingTotemField(HEALING_TOTEM_CAPACITY);
  rig.scene.add(healingTotems.mesh);

  const cannons = new CannonField(CANNON_CAPACITY);
  rig.scene.add(cannons.mesh);

  // Register every structure field that should block enemy movement here.
  // ObstacleBuffer only needs pool/posX/posZ/radius, so this fans out to any
  // number of structure types without EnemyField importing them directly.
  const structures = new StructureRegistry();
  structures.register(towers);
  structures.register(walls);
  structures.register(healingTotems);
  structures.register(cannons);
  const obstacles = new ObstacleBuffer(OBSTACLE_CAPACITY);

  // Game-input listeners (aim raycast, placement clicks) attach to the canvas
  // itself, not the outer container — UI buttons are siblings layered on top
  // via z-index, not DOM descendants of the canvas, so their clicks never
  // reach these handlers. Attaching to `container` instead would mean every
  // button click also bubbles into "place a structure here".
  const canvas = rig.renderer.domElement;
  const spawner = new EnemySpawner(enemies);
  const aim = new PlayerAimSystem(canvas, rig.camera);
  const combat = new CombatSystem(player, enemies, projectiles, aim);
  const upgrades = new UpgradeSystem();
  const abilities = new AbilityTreeSystem();
  const perks = new PerkSystem((cost) => upgrades.spendCurrency(cost));
  const towerCombat = new TowerCombatSystem(towers, enemies, projectiles);
  const cannonCombat = new CannonCombatSystem(cannons, enemies, projectiles);
  const healing = new HealingSystem(healingTotems, player, [towers, walls, cannons, healingTotems]);

  const structureDefs: StructureDef[] = [
    {
      kind: StructureKind.Tower,
      name: 'Tower',
      cost: 20,
      radius: 0.6,
      scale: 1,
      color: 0x3fdc6a,
      shape: 'cylinder',
      height: 1.6,
      spawn: (x, z) => towers.spawn({ x, z, hp: 60, radius: 0.6, scale: 1, fireRange: 11, fireCooldown: 0.35, damage: 14 }),
    },
    {
      kind: StructureKind.Wall,
      name: 'Wall',
      cost: 8,
      radius: 0.55,
      scale: 1,
      color: 0x8a8f8c,
      shape: 'box',
      height: 1.1,
      spawn: (x, z) => walls.spawn({ x, z, hp: 80, radius: 0.55, scale: 1 }),
    },
    {
      kind: StructureKind.Healing,
      name: 'Totem',
      cost: 30,
      radius: 0.55,
      scale: 1,
      color: 0x4fe0c0,
      shape: 'cylinder',
      height: 1.3,
      spawn: (x, z) => healingTotems.spawn({ x, z, hp: 50, radius: 0.55, scale: 1, healRange: 6, healRate: 4 }),
    },
    {
      kind: StructureKind.Cannon,
      name: 'Cannon',
      cost: 35,
      radius: 0.9,
      scale: 1,
      color: 0xdc8f3f,
      shape: 'cylinder',
      height: 2.1,
      spawn: (x, z) =>
        cannons.spawn({ x, z, hp: 75, radius: 0.9, scale: 1, fireRange: 9, fireCooldown: 1.0, damage: 20, splash: 2.5 }),
    },
  ];

  const placement = new StructurePlacementSystem(canvas, rig.camera, rig.scene, structureDefs, upgrades);
  const input = new InputManager();
  const hud = new PerfHud(container);
  const healthBars = new HealthBarOverlay(container);
  const waveTimerBar = new WaveTimerBar(container);
  const clock = new Clock();
  const fsm = new GauntletStateMachine();
  let waveStrength = 0;
  let waveTimeRemaining = devConfig.waveDurationSeconds;
  let runCurrencyEarned = 0;

  /** Recomputes player stats from base (upgrades + abilities + perks + dev multipliers) — never incremental, safe to call anytime. */
  function reapplyPlayerStats(): void {
    upgrades.applyAll(player);
    abilities.applyAll(player);
    perks.applyAll(player);
    player.damage *= devConfig.playerDamageMult;
    player.speed *= devConfig.playerSpeedMult;
    player.fireCooldown /= devConfig.playerFireRateMult;
  }

  const hub = new HubOverlay(container, upgrades, abilities, {
    onStartWave: () => fsm.dispatch({ type: 'START_RUN' }),
  });

  const planning = new PlanningOverlay(container, placement, upgrades, {
    onBeginWave: () => fsm.dispatch({ type: 'BEGIN_WAVE' }),
  });

  const perkShop = new PerkShopOverlay(container, upgrades, perks);

  const resolution = new ResolutionOverlay(container, () => fsm.dispatch({ type: 'RETURN_TO_HUB' }));

  function killEveryone(): void {
    enemies.killAll();
    projectiles.killAll();
    towers.killAll();
    walls.killAll();
    healingTotems.killAll();
    cannons.killAll();
  }

  fsm.onChange((next) => {
    if (next === GauntletState.Hub) {
      hub.show();
      planning.hide();
      resolution.hide();
      waveTimerBar.hide();
      placement.setEnabled(false);
      spawner.enabled = false;
      killEveryone();
      waveStrength = 0;
      perks.resetRun();
    } else if (next === GauntletState.Planning) {
      hub.hide();
      resolution.hide();
      planning.show();
      perkShop.show();
      placement.setEnabled(true); // structures are built here, before the wave starts — not mid-fight
      spawner.enabled = false;
      player.x = 0;
      player.z = 0;
      player.hp = player.maxHp;
    } else if (next === GauntletState.Action) {
      planning.hide();
      perkShop.hide();
      placement.setEnabled(false);
      spawner.enabled = true;
      reapplyPlayerStats();
      player.hp = player.maxHp;
      waveTimeRemaining = devConfig.waveDurationSeconds;
      runCurrencyEarned = 0;
      waveTimerBar.show();
    } else if (next === GauntletState.Resolution) {
      waveTimerBar.hide();
    }
  });

  function endWave(won: boolean): void {
    resolution.showResult(won, runCurrencyEarned);
    fsm.dispatch(won ? { type: 'WAVE_CLEARED' } : { type: 'PLAYER_DIED' });
  }

  const devPanel = new DevPanel(container, {
    getState: () => fsm.current,
    getCurrency: () => upgrades.currency,
    addCurrency: (amount) => upgrades.addCurrency(amount),
    killAllEnemies: () => enemies.killAll(),
    burstSpawnEnemies: (count) => spawner.burst(count, player.x, player.z),
    forceWaveClear: () => {
      if (fsm.current === GauntletState.Action) endWave(true);
    },
    forceWaveDeath: () => {
      if (fsm.current === GauntletState.Action) endWave(false);
    },
    reapplyPlayerStats,
  });

  // Dev perf harness: burst-spawn the Plan.md-mandated 1,000 enemies to
  // verify the pool/instancing/grid can hold 60fps before wiring full waves.
  const params = new URLSearchParams(location.search);
  if (params.has('perftest')) {
    const n = Number(params.get('perftest')) || 1000;
    fsm.dispatch({ type: 'START_RUN' });
    fsm.dispatch({ type: 'BEGIN_WAVE' });
    spawner.burst(n, 0, 0);
  }

  function frame(nowMs: number): void {
    const dt = clock.tick(nowMs) * devConfig.timeScale;

    if (fsm.current === GauntletState.Planning) {
      player.update(dt, input.state);
      rig.follow(player.x, player.z);
      planning.refresh(); // live currency/affordability readout while structures are bought mid-planning
    } else if (fsm.current === GauntletState.Action) {
      player.update(dt, input.state);
      spawner.update(dt, player.x, player.z, waveStrength);
      obstacles.rebuild(structures.sources);
      enemies.update(dt, player.x, player.z, obstacles, (x, z, dirX, dirZ, damage) => {
        projectiles.spawn(x, z, dirX, dirZ, 16 * devConfig.projectileSpeedMult, damage, 2.5, { side: ProjectileSide.Enemy, radius: 0.22 });
      });
      projectiles.update(dt);
      combat.update(
        dt,
        input.state.fire,
        () => {
          waveStrength += 0.02;
          upgrades.addCurrency(1);
          runCurrencyEarned += 1;
        },
        (dmg) => {
          if (devConfig.godMode) return;
          player.hp -= dmg;
          if (player.hp <= 0) {
            if (player.secondWindAvailable) {
              player.secondWindAvailable = false;
              player.hp = player.maxHp * 0.3;
            } else {
              endWave(false);
            }
          }
        },
      );
      towerCombat.update(dt, () => {});
      cannonCombat.update(dt, () => {});
      walls.update(dt, enemies, () => {});
      healingTotems.update(dt, enemies, () => {});
      healing.update(dt);
      rig.follow(player.x, player.z);

      waveTimeRemaining -= dt;
      waveTimerBar.update(waveTimeRemaining, devConfig.waveDurationSeconds);
      if (waveTimeRemaining <= 0) {
        const bonus = 15;
        upgrades.addCurrency(bonus);
        runCurrencyEarned += bonus;
        endWave(true);
      }
    }

    healthBars.update(rig.camera, player, enemies, [towers, walls, healingTotems, cannons]);
    hud.update(
      dt,
      enemies.pool.liveCount,
      projectiles.pool.liveCount,
      fsm.current,
      towers.pool.liveCount + walls.pool.liveCount + healingTotems.pool.liveCount + cannons.pool.liveCount,
      upgrades.currency,
      placement.placementMode,
    );
    rig.render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error('Fatal init error:', err);
  const el = document.getElementById('app');
  if (el) el.textContent = `Failed to start: ${err instanceof Error ? err.message : String(err)}`;
});
