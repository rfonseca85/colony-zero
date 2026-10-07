import { StructureDef, StructurePlacementSystem } from '@/systems/StructurePlacementSystem';
import { UpgradeSystem } from '@/systems/UpgradeSystem';

export interface PlanningOverlayCallbacks {
  onBeginWave: () => void;
}

/**
 * Pre-wave build-phase panel: a structure palette (cost, hotkey, selection
 * highlight), a currency readout, and the Begin Wave action. Plain DOM +
 * cssText, matching HubOverlay/PerfHud's dark-terminal visual language.
 */
export class PlanningOverlay {
  readonly el: HTMLDivElement;
  private currencyEl: HTMLDivElement;
  private cards: { btn: HTMLButtonElement; def: StructureDef }[] = [];

  constructor(
    container: HTMLElement,
    private placement: StructurePlacementSystem,
    private upgrades: UpgradeSystem,
    callbacks: PlanningOverlayCallbacks,
  ) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 15;
      display: none; flex-direction: column; align-items: center; gap: 10px;
      font-family: 'SF Mono', Menlo, monospace; color: #d8e6de;
    `;

    const label = document.createElement('div');
    label.textContent = 'PLANNING — place structures (1-4 or click), then begin the wave';
    label.style.cssText = 'font-size: 12px; color: #7d948a;';

    const panel = document.createElement('div');
    panel.style.cssText = `
      display: flex; align-items: center; gap: 14px;
      background: rgba(10,16,13,0.82); padding: 10px 18px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1);
    `;

    this.currencyEl = document.createElement('div');
    this.currencyEl.style.cssText = 'font-size: 13px; color: #ffe066; font-weight: 700; white-space: nowrap;';

    const palette = document.createElement('div');
    palette.style.cssText = 'display: flex; gap: 8px;';
    placement.defs.forEach((def, i) => palette.appendChild(this.buildCard(def, i)));

    const btn = document.createElement('button');
    btn.textContent = 'BEGIN WAVE';
    btn.style.cssText = `
      padding: 8px 18px; font-family: inherit; font-size: 13px; font-weight: 700;
      letter-spacing: 0.05em; background: #6ee7a0; color: #0b0f0d; border: none;
      border-radius: 6px; cursor: pointer; white-space: nowrap;
    `;
    btn.addEventListener('click', () => callbacks.onBeginWave());

    panel.append(this.currencyEl, palette, btn);
    this.el.append(label, panel);
    container.appendChild(this.el);

    placement.setOnSelectionChange(() => this.refresh());
    this.refresh();
  }

  private buildCard(def: StructureDef, index: number): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.style.cssText = `
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      font-family: inherit; padding: 6px 10px; border-radius: 6px; cursor: pointer;
      border: 1px solid rgba(255,255,255,0.12); min-width: 68px;
    `;

    const swatch = document.createElement('div');
    swatch.style.cssText = `width: 16px; height: 16px; border-radius: 3px; background: #${def.color.toString(16).padStart(6, '0')};`;

    const name = document.createElement('div');
    name.textContent = `${index + 1}. ${def.name}`;
    name.style.cssText = 'font-size: 11px; font-weight: 700;';

    const cost = document.createElement('div');
    cost.textContent = `${def.cost}`;
    cost.style.cssText = 'font-size: 11px;';

    btn.append(swatch, name, cost);
    btn.addEventListener('click', () => this.placement.select(index));

    this.cards.push({ btn, def });
    return btn;
  }

  refresh(): void {
    this.currencyEl.textContent = `CREDITS: ${this.upgrades.currency}`;

    for (const { btn, def } of this.cards) {
      const index = this.placement.defs.indexOf(def);
      const selected = index === this.placement.selectedIndex;
      const affordable = this.upgrades.currency >= def.cost;

      btn.style.background = selected ? 'rgba(110,231,160,0.18)' : 'rgba(255,255,255,0.04)';
      btn.style.borderColor = selected ? '#6ee7a0' : 'rgba(255,255,255,0.12)';
      btn.style.color = affordable ? '#d8e6de' : '#5a6b62';
      btn.style.opacity = affordable ? '1' : '0.55';
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
