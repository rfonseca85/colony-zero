import { PerkSystem, PERK_DEFS } from '@/systems/PerkSystem';
import { UpgradeSystem } from '@/systems/UpgradeSystem';

/**
 * Planning-phase panel for temporary run perks. Anchored to the left edge
 * (vs. the structure palette, which another agent is adding to the
 * default top-center PlanningOverlay stub) so the two panels don't stack
 * on top of each other.
 */
export class PerkShopOverlay {
  readonly el: HTMLDivElement;
  private rowsEl: HTMLDivElement;
  private rows: Map<string, { buyBtn: HTMLButtonElement; costEl: HTMLSpanElement }> = new Map();

  constructor(
    container: HTMLElement,
    private upgrades: UpgradeSystem,
    private perks: PerkSystem,
  ) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute; bottom: 12px; left: 12px; z-index: 15;
      display: none; flex-direction: column; gap: 8px;
      background: rgba(10,16,13,0.82); padding: 14px 16px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1); font-family: 'SF Mono', Menlo, monospace;
      color: #d8e6de; min-width: 220px;
    `;

    const title = document.createElement('div');
    title.textContent = 'RUN PERKS';
    title.style.cssText = 'font-size: 13px; font-weight: 700; color: #6ee7a0; letter-spacing: 0.05em;';

    const sub = document.createElement('div');
    sub.textContent = 'Lost on return to hub';
    sub.style.cssText = 'font-size: 10px; color: #7d948a; margin-bottom: 4px;';

    this.rowsEl = document.createElement('div');
    this.rowsEl.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

    for (const def of PERK_DEFS) {
      this.rows.set(def.id, this.buildRow(def));
    }

    this.el.append(title, sub, this.rowsEl);
    container.appendChild(this.el);
  }

  private buildRow(def: (typeof PERK_DEFS)[number]): { buyBtn: HTMLButtonElement; costEl: HTMLSpanElement } {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
    `;

    const info = document.createElement('div');
    info.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const name = document.createElement('div');
    name.textContent = def.name;
    name.style.cssText = 'font-size: 12px; font-weight: 700; color: #d8e6de;';

    const desc = document.createElement('div');
    desc.textContent = def.description;
    desc.style.cssText = 'font-size: 10px; color: #7d948a;';

    info.append(name, desc);

    const buyBtn = document.createElement('button');
    buyBtn.style.cssText = `
      font-family: inherit; font-size: 11px; font-weight: 700; padding: 7px 12px;
      border: none; border-radius: 5px; cursor: pointer; white-space: nowrap;
    `;
    const costEl = document.createElement('span');
    buyBtn.appendChild(costEl);

    buyBtn.addEventListener('click', () => {
      if (this.perks.buy(def.id)) this.refresh();
    });

    row.append(info, buyBtn);
    this.rowsEl.appendChild(row);
    return { buyBtn, costEl };
  }

  refresh(): void {
    for (const def of PERK_DEFS) {
      const row = this.rows.get(def.id);
      if (!row) continue;
      const bought = this.perks.isPurchased(def.id);
      const affordable = !bought && this.upgrades.currency >= def.cost;

      row.costEl.textContent = bought ? 'ACTIVE' : `BUY (${def.cost})`;
      row.buyBtn.disabled = bought || !affordable;
      row.buyBtn.style.background = bought ? 'rgba(110,231,160,0.25)' : affordable ? '#6ee7a0' : 'rgba(255,255,255,0.08)';
      row.buyBtn.style.color = bought ? '#6ee7a0' : affordable ? '#0b0f0d' : '#5a6b62';
      row.buyBtn.style.cursor = bought || !affordable ? 'not-allowed' : 'pointer';
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
