import { devConfig, DevConfigData } from '@/core/DevConfig';
import { GauntletState } from '@/core/GauntletStateMachine';

export interface DevPanelHooks {
  getState: () => GauntletState;
  getCurrency: () => number;
  addCurrency: (amount: number) => void;
  killAllEnemies: () => void;
  burstSpawnEnemies: (count: number) => void;
  forceWaveClear: () => void;
  forceWaveDeath: () => void;
  /** Recomputes player stats from base (upgrades + abilities + perks + dev multipliers) — never incremental. */
  reapplyPlayerStats: () => void;
}

interface FieldSpec {
  key: keyof DevConfigData;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Multiplier fields read/write as-is; rate-like fields are still plain numbers — kept uniform for the slider UI. */
  format?: (v: number) => string;
}

const PLAYER_FIELDS: FieldSpec[] = [
  { key: 'playerDamageMult', label: 'Damage ×', min: 0.1, max: 10, step: 0.1 },
  { key: 'playerSpeedMult', label: 'Speed ×', min: 0.1, max: 5, step: 0.1 },
  { key: 'playerFireRateMult', label: 'Fire rate ×', min: 0.1, max: 10, step: 0.1 },
];

const ENEMY_FIELDS: FieldSpec[] = [
  { key: 'enemyHpMult', label: 'HP ×', min: 0, max: 20, step: 0.1 },
  { key: 'enemySpeedMult', label: 'Speed ×', min: 0, max: 5, step: 0.1 },
  { key: 'enemyDamageMult', label: 'Damage ×', min: 0, max: 20, step: 0.1 },
  { key: 'enemySpawnRateMult', label: 'Spawn rate ×', min: 0, max: 20, step: 0.1 },
  { key: 'maxConcurrentEnemies', label: 'Max alive (0=∞)', min: 0, max: 220, step: 10 },
];

const PROJECTILE_FIELDS: FieldSpec[] = [{ key: 'projectileSpeedMult', label: 'Speed ×', min: 0.1, max: 10, step: 0.1 }];

const WAVE_FIELDS: FieldSpec[] = [
  { key: 'waveDurationSeconds', label: 'Duration (s)', min: 5, max: 600, step: 5 },
  { key: 'timeScale', label: 'Game speed ×', min: 0.1, max: 5, step: 0.1 },
];

/**
 * Dev/testing panel — toggled with the backquote key at any Gauntlet state.
 * Every slider writes straight into the devConfig singleton and systems
 * (EnemySpawner, CombatSystem, UpgradeSystem, ...) read it live, so changes
 * take effect immediately without restarting a wave. Visually distinct
 * (amber accent) from the player-facing mint/green UI so it reads as a
 * separate, "dangerous" surface.
 */
export class DevPanel {
  readonly el: HTMLDivElement;
  private visible = false;
  private bodyEl: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private burstInput: HTMLInputElement;
  private addCurrencyInput: HTMLInputElement;

  constructor(
    container: HTMLElement,
    private hooks: DevPanelHooks,
  ) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute; top: 0; right: 0; bottom: 0; z-index: 50;
      display: none; flex-direction: column;
      width: 300px; background: rgba(12, 9, 6, 0.94); border-left: 1px solid rgba(240,178,84,0.35);
      font-family: 'SF Mono', Menlo, monospace; color: #e6dcd0; overflow-y: auto;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 16px; border-bottom: 1px solid rgba(240,178,84,0.25);
      display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0;
      background: rgba(12, 9, 6, 0.98);
    `;
    const title = document.createElement('div');
    title.textContent = 'DEV MODE';
    title.style.cssText = 'font-size: 13px; font-weight: 700; letter-spacing: 0.08em; color: #f0b254;';
    const hint = document.createElement('div');
    hint.textContent = '` to close';
    hint.style.cssText = 'font-size: 10px; color: #8a7d6c;';
    header.append(title, hint);

    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText = 'padding: 8px 16px; font-size: 11px; color: #8a7d6c; border-bottom: 1px solid rgba(240,178,84,0.15);';

    this.bodyEl = document.createElement('div');
    this.bodyEl.style.cssText = 'display: flex; flex-direction: column; gap: 14px; padding: 14px 16px;';

    this.el.append(header, this.statusEl, this.bodyEl);
    container.appendChild(this.el);

    this.burstInput = document.createElement('input');
    this.addCurrencyInput = document.createElement('input');

    this.buildEconomySection();
    this.buildPlayerSection();
    this.buildEnemySection();
    this.buildProjectileSection();
    this.buildWaveSection();
    this.buildActionsSection();
    this.buildResetSection();

    window.addEventListener('keydown', this.onKeyDown);
    devConfig.onChange(() => this.refresh());
    this.refresh();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code !== 'Backquote') return;
    e.preventDefault();
    this.toggle();
  };

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'flex' : 'none';
    if (this.visible) this.refresh();
  }

  private sectionTitle(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #f0b254; text-transform: uppercase;';
    return el;
  }

  private checkboxRow(label: string, get: () => boolean, set: (v: boolean) => void): HTMLLabelElement {
    const row = document.createElement('label');
    row.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; user-select: none;';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = get();
    box.addEventListener('change', () => {
      set(box.checked);
      devConfig.notify();
      this.hooks.reapplyPlayerStats();
    });
    const text = document.createElement('span');
    text.textContent = label;
    row.append(box, text);
    return row;
  }

  private sliderRow(spec: FieldSpec, onInput?: () => void): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; flex-direction: column; gap: 3px;';

    const labelRow = document.createElement('div');
    labelRow.style.cssText = 'display: flex; justify-content: space-between; font-size: 11px; color: #c9bba9;';
    const labelEl = document.createElement('span');
    labelEl.textContent = spec.label;
    const valueEl = document.createElement('span');
    valueEl.style.cssText = 'color: #f0b254; font-weight: 700;';
    labelRow.append(labelEl, valueEl);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.style.cssText = 'width: 100%; accent-color: #f0b254;';
    input.value = String(devConfig[spec.key]);
    valueEl.textContent = String(devConfig[spec.key]);

    input.addEventListener('input', () => {
      (devConfig[spec.key] as number) = Number(input.value);
      valueEl.textContent = input.value;
      devConfig.notify();
      onInput?.();
    });

    row.append(labelRow, input);
    (row as HTMLDivElement & { __spec?: FieldSpec }).__spec = spec;
    return row;
  }

  private buildEconomySection(): void {
    this.bodyEl.append(
      this.sectionTitle('Economy'),
      this.checkboxRow(
        'Infinite money',
        () => devConfig.infiniteMoney,
        (v) => (devConfig.infiniteMoney = v),
      ),
    );

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 6px;';
    this.addCurrencyInput.type = 'number';
    this.addCurrencyInput.value = '500';
    this.addCurrencyInput.style.cssText = `
      flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
      color: #e6dcd0; border-radius: 4px; padding: 4px 6px; font-family: inherit; font-size: 11px;
    `;
    const btn = this.actionButton('+ Add', () => this.hooks.addCurrency(Number(this.addCurrencyInput.value) || 0));
    row.append(this.addCurrencyInput, btn);
    this.bodyEl.appendChild(row);
  }

  private buildPlayerSection(): void {
    this.bodyEl.append(
      this.sectionTitle('Player'),
      this.checkboxRow(
        'God mode (no damage taken)',
        () => devConfig.godMode,
        (v) => (devConfig.godMode = v),
      ),
      ...PLAYER_FIELDS.map((f) => this.sliderRow(f, () => this.hooks.reapplyPlayerStats())),
    );
  }

  private buildEnemySection(): void {
    this.bodyEl.append(this.sectionTitle('Enemies'), ...ENEMY_FIELDS.map((f) => this.sliderRow(f)));

    const chanceRow = document.createElement('div');
    chanceRow.style.cssText = 'display: flex; flex-direction: column; gap: 6px; font-size: 11px; color: #c9bba9;';
    chanceRow.append(
      this.overrideToggle('Elite chance override', 'eliteChanceOverride'),
      this.overrideToggle('Ranged chance override', 'rangedChanceOverride'),
    );
    this.bodyEl.appendChild(chanceRow);

    const burstRow = document.createElement('div');
    burstRow.style.cssText = 'display: flex; gap: 6px; margin-top: 2px;';
    this.burstInput.type = 'number';
    this.burstInput.value = '100';
    this.burstInput.style.cssText = `
      flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
      color: #e6dcd0; border-radius: 4px; padding: 4px 6px; font-family: inherit; font-size: 11px;
    `;
    const burstBtn = this.actionButton('Burst spawn', () => this.hooks.burstSpawnEnemies(Number(this.burstInput.value) || 0));
    burstRow.append(this.burstInput, burstBtn);
    this.bodyEl.appendChild(burstRow);
    this.bodyEl.appendChild(this.actionButton('Kill all enemies', () => this.hooks.killAllEnemies(), true));
  }

  private overrideToggle(label: string, key: 'eliteChanceOverride' | 'rangedChanceOverride'): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = devConfig[key] !== null;

    const text = document.createElement('span');
    text.textContent = label;
    text.style.cssText = 'flex: 1;';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.05';
    slider.style.cssText = 'width: 70px; accent-color: #f0b254;';
    slider.value = String(devConfig[key] ?? 0.2);
    slider.disabled = devConfig[key] === null;

    checkbox.addEventListener('change', () => {
      devConfig[key] = checkbox.checked ? Number(slider.value) : null;
      slider.disabled = !checkbox.checked;
      devConfig.notify();
    });
    slider.addEventListener('input', () => {
      if (checkbox.checked) {
        devConfig[key] = Number(slider.value);
        devConfig.notify();
      }
    });

    wrap.append(checkbox, text, slider);
    return wrap;
  }

  private buildProjectileSection(): void {
    this.bodyEl.append(this.sectionTitle('Projectiles'), ...PROJECTILE_FIELDS.map((f) => this.sliderRow(f)));
  }

  private buildWaveSection(): void {
    this.bodyEl.append(this.sectionTitle('Wave'), ...WAVE_FIELDS.map((f) => this.sliderRow(f)));
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 6px;';
    row.append(
      this.actionButton('Force clear', () => this.hooks.forceWaveClear()),
      this.actionButton('Force death', () => this.hooks.forceWaveDeath()),
    );
    this.bodyEl.appendChild(row);
  }

  private buildActionsSection(): void {
    // Actions live inline with their sections above; nothing extra needed here currently.
  }

  private buildResetSection(): void {
    this.bodyEl.appendChild(this.actionButton('Reset all to defaults', () => devConfig.reset(), true));
  }

  private actionButton(label: string, onClick: () => void, full = false): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      ${full ? 'width: 100%;' : 'flex-shrink: 0;'}
      padding: 7px 12px; font-family: inherit; font-size: 11px; font-weight: 700;
      background: rgba(240,178,84,0.15); color: #f0b254; border: 1px solid rgba(240,178,84,0.4);
      border-radius: 5px; cursor: pointer; white-space: nowrap;
    `;
    btn.addEventListener('click', onClick);
    return btn;
  }

  refresh(): void {
    this.statusEl.textContent = `state: ${this.hooks.getState()} · currency: ${this.hooks.getCurrency()}`;

    for (const row of Array.from(this.bodyEl.children)) {
      const spec = (row as HTMLDivElement & { __spec?: FieldSpec }).__spec;
      if (!spec) continue;
      const input = row.querySelector('input[type="range"]') as HTMLInputElement | null;
      const valueEl = row.querySelector('span:last-child') as HTMLSpanElement | null;
      if (input) input.value = String(devConfig[spec.key]);
      if (valueEl) valueEl.textContent = String(devConfig[spec.key]);
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
