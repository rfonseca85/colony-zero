/** Brief win/loss screen shown between a wave ending and returning to the Hub. */
export class ResolutionOverlay {
  readonly el: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private subEl: HTMLDivElement;

  constructor(container: HTMLElement, onContinue: () => void) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute; inset: 0; z-index: 25; display: none;
      align-items: center; justify-content: center; flex-direction: column; gap: 14px;
      background: rgba(6,9,7,0.88); font-family: 'SF Mono', Menlo, monospace; color: #d8e6de;
    `;

    this.titleEl = document.createElement('div');
    this.titleEl.style.cssText = 'font-size: 26px; letter-spacing: 0.08em;';

    this.subEl = document.createElement('div');
    this.subEl.style.cssText = 'font-size: 13px; color: #9fb3a8;';

    const btn = document.createElement('button');
    btn.textContent = 'CONTINUE';
    btn.style.cssText = `
      margin-top: 10px; padding: 10px 24px; font-family: inherit; font-size: 13px; font-weight: 700;
      letter-spacing: 0.05em; background: #6ee7a0; color: #0b0f0d; border: none; border-radius: 6px; cursor: pointer;
    `;
    btn.addEventListener('click', onContinue);

    this.el.append(this.titleEl, this.subEl, btn);
    container.appendChild(this.el);
  }

  showResult(won: boolean, currencyEarned: number): void {
    this.titleEl.textContent = won ? 'WAVE CLEARED' : 'YOU DIED';
    this.titleEl.style.color = won ? '#6ee7a0' : '#e2574c';
    this.subEl.textContent = `+${currencyEarned} currency banked`;
    this.el.style.display = 'flex';
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}
