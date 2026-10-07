import { UpgradeSystem, UPGRADE_DEFS } from '@/systems/UpgradeSystem';
import { AbilityTreeSystem, ABILITY_DEFS } from '@/systems/AbilityTreeSystem';

export interface HubOverlayCallbacks {
  onStartWave: () => void;
}

/**
 * Hub phase panel: currency readout, a buy row per permanent upgrade, the
 * ability tree, and the Start Wave action. Plain DOM + cssText, matching
 * PerfHud's style.
 */
export class HubOverlay {
  readonly el: HTMLDivElement;
  private currencyEl: HTMLDivElement;
  private rowsEl: HTMLDivElement;
  private rows: Map<string, { costEl: HTMLSpanElement; levelEl: HTMLSpanElement; buyBtn: HTMLButtonElement }> =
    new Map();
  private abilityRowsEl: HTMLDivElement;
  private abilityRows: Map<string, { costEl: HTMLSpanElement; buyBtn: HTMLButtonElement }> = new Map();

  constructor(
    container: HTMLElement,
    private upgrades: UpgradeSystem,
    private abilities: AbilityTreeSystem,
    callbacks: HubOverlayCallbacks,
  ) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute; inset: 0; z-index: 20;
      display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 14px;
      background: radial-gradient(ellipse at center, rgba(16,22,19,0.85), rgba(6,9,7,0.96));
      font-family: 'SF Mono', Menlo, monospace; color: #d8e6de;
    `;

    const title = document.createElement('div');
    title.textContent = 'COLONY ZERO';
    title.style.cssText = 'font-size: 28px; letter-spacing: 0.1em; color: #6ee7a0;';

    const sub = document.createElement('div');
    sub.textContent = 'Hub — spend currency on permanent upgrades, then head to the map';
    sub.style.cssText = 'font-size: 13px; color: #7d948a;';

    this.currencyEl = document.createElement('div');
    this.currencyEl.style.cssText = 'font-size: 16px; color: #ffe066; font-weight: 700; margin-top: 4px;';

    const panel = document.createElement('div');
    panel.style.cssText = `
      display: flex; flex-direction: column; gap: 8px;
      background: rgba(10, 16, 13, 0.72); padding: 16px 20px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08); min-width: 360px;
    `;

    this.rowsEl = document.createElement('div');
    this.rowsEl.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
    panel.appendChild(this.rowsEl);

    for (const def of UPGRADE_DEFS) {
      this.rows.set(def.id, this.buildRow(def));
    }

    const abilityTitle = document.createElement('div');
    abilityTitle.textContent = 'ABILITY TREE';
    abilityTitle.style.cssText = 'font-size: 13px; font-weight: 700; color: #6ee7a0; letter-spacing: 0.05em; margin-top: 4px;';

    const abilityPanel = document.createElement('div');
    abilityPanel.style.cssText = `
      display: flex; flex-direction: column; gap: 8px;
      background: rgba(10, 16, 13, 0.72); padding: 16px 20px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08); min-width: 360px;
    `;

    this.abilityRowsEl = document.createElement('div');
    this.abilityRowsEl.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
    abilityPanel.appendChild(this.abilityRowsEl);

    for (const def of ABILITY_DEFS) {
      this.abilityRows.set(def.id, this.buildAbilityRow(def));
    }

    const startBtn = document.createElement('button');
    startBtn.textContent = 'OPEN MAP';
    startBtn.style.cssText = `
      margin-top: 8px; padding: 12px 28px; font-family: inherit; font-size: 14px;
      letter-spacing: 0.08em; background: #6ee7a0; color: #0b0f0d; border: none;
      border-radius: 6px; cursor: pointer; font-weight: 700;
    `;
    startBtn.addEventListener('click', () => callbacks.onStartWave());

    this.el.append(title, sub, this.currencyEl, panel, abilityTitle, abilityPanel, startBtn);
    container.appendChild(this.el);
    this.refresh();
  }

  private buildRow(def: (typeof UPGRADE_DEFS)[number]): {
    costEl: HTMLSpanElement;
    levelEl: HTMLSpanElement;
    buyBtn: HTMLButtonElement;
  } {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
    `;

    const info = document.createElement('div');
    info.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const name = document.createElement('div');
    name.textContent = def.name;
    name.style.cssText = 'font-size: 13px; font-weight: 700; color: #d8e6de;';

    const desc = document.createElement('div');
    desc.textContent = def.description;
    desc.style.cssText = 'font-size: 11px; color: #7d948a;';

    const levelEl = document.createElement('span');
    levelEl.style.cssText = 'font-size: 11px; color: #6ee7a0;';

    info.append(name, desc, levelEl);

    const buyBtn = document.createElement('button');
    buyBtn.style.cssText = `
      font-family: inherit; font-size: 12px; font-weight: 700; padding: 8px 14px;
      border: none; border-radius: 5px; cursor: pointer; white-space: nowrap;
    `;
    const costEl = document.createElement('span');
    buyBtn.appendChild(costEl);

    buyBtn.addEventListener('click', () => {
      if (this.upgrades.purchase(def.id)) this.refresh();
    });

    row.append(info, buyBtn);
    this.rowsEl.appendChild(row);
    return { costEl, levelEl, buyBtn };
  }

  private buildAbilityRow(def: (typeof ABILITY_DEFS)[number]): { costEl: HTMLSpanElement; buyBtn: HTMLButtonElement } {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
    `;

    const info = document.createElement('div');
    info.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const name = document.createElement('div');
    name.textContent = def.name;
    name.style.cssText = 'font-size: 13px; font-weight: 700; color: #d8e6de;';

    const desc = document.createElement('div');
    desc.textContent = def.requires ? `${def.description} (requires ${def.requires})` : def.description;
    desc.style.cssText = 'font-size: 11px; color: #7d948a;';

    info.append(name, desc);

    const buyBtn = document.createElement('button');
    buyBtn.style.cssText = `
      font-family: inherit; font-size: 12px; font-weight: 700; padding: 8px 14px;
      border: none; border-radius: 5px; cursor: pointer; white-space: nowrap;
    `;
    const costEl = document.createElement('span');
    buyBtn.appendChild(costEl);

    buyBtn.addEventListener('click', () => {
      if (this.abilities.unlock(def.id, (cost) => this.upgrades.spendCurrency(cost))) this.refresh();
    });

    row.append(info, buyBtn);
    this.abilityRowsEl.appendChild(row);
    return { costEl, buyBtn };
  }

  refresh(): void {
    this.currencyEl.textContent = `CREDITS: ${this.upgrades.currency}`;

    for (const def of UPGRADE_DEFS) {
      const row = this.rows.get(def.id);
      if (!row) continue;
      const level = this.upgrades.getLevel(def.id);
      const maxed = level >= def.maxLevel;
      const cost = this.upgrades.getCost(def.id);
      const affordable = !maxed && this.upgrades.canAfford(def.id);

      row.levelEl.textContent = `Level ${level}/${def.maxLevel}`;
      row.costEl.textContent = maxed ? 'MAX' : `BUY (${cost})`;
      row.buyBtn.disabled = !affordable;
      row.buyBtn.style.background = affordable ? '#6ee7a0' : 'rgba(255,255,255,0.08)';
      row.buyBtn.style.color = affordable ? '#0b0f0d' : '#5a6b62';
      row.buyBtn.style.cursor = affordable ? 'pointer' : 'not-allowed';
    }

    for (const def of ABILITY_DEFS) {
      const row = this.abilityRows.get(def.id);
      if (!row) continue;
      const unlocked = this.abilities.isUnlocked(def.id);
      const affordable = !unlocked && this.abilities.canUnlock(def.id, this.upgrades.currency);

      row.costEl.textContent = unlocked ? 'UNLOCKED' : `BUY (${def.cost})`;
      row.buyBtn.disabled = unlocked || !affordable;
      row.buyBtn.style.background = unlocked ? 'rgba(110,231,160,0.25)' : affordable ? '#6ee7a0' : 'rgba(255,255,255,0.08)';
      row.buyBtn.style.color = unlocked ? '#6ee7a0' : affordable ? '#0b0f0d' : '#5a6b62';
      row.buyBtn.style.cursor = unlocked || !affordable ? 'not-allowed' : 'pointer';
    }
  }

  show(): void {
    this.refresh();
    this.el.style.display = 'flex';
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}
