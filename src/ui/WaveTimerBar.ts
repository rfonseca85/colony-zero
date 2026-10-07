/** Top-of-screen bar that drains as the wave's clock runs down — less bar, less time left. */
export class WaveTimerBar {
  private wrap: HTMLDivElement;
  private fill: HTMLDivElement;
  private label: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.wrap = document.createElement('div');
    this.wrap.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0; z-index: 8;
      height: 22px; display: none; flex-direction: column; align-items: stretch;
      pointer-events: none;
    `;

    const track = document.createElement('div');
    track.style.cssText = `
      height: 10px; background: rgba(0,0,0,0.45); border-bottom: 1px solid rgba(255,255,255,0.1);
    `;

    this.fill = document.createElement('div');
    this.fill.style.cssText = `height: 100%; width: 100%; background: #6ee7a0; transition: width 0.15s linear, background 0.3s;`;
    track.appendChild(this.fill);

    this.label = document.createElement('div');
    this.label.style.cssText = `
      align-self: center; margin-top: 2px; font: 11px 'SF Mono', Menlo, monospace;
      color: #d8e6de; text-shadow: 0 1px 2px rgba(0,0,0,0.8); letter-spacing: 0.05em;
    `;

    this.wrap.append(track, this.label);
    container.appendChild(this.wrap);
  }

  show(): void {
    this.wrap.style.display = 'flex';
  }

  hide(): void {
    this.wrap.style.display = 'none';
  }

  update(remaining: number, duration: number): void {
    const frac = Math.max(0, Math.min(1, remaining / duration));
    this.fill.style.width = `${frac * 100}%`;
    this.fill.style.background = frac > 0.5 ? '#6ee7a0' : frac > 0.2 ? '#f0b254' : '#e2574c';
    this.label.textContent = `${Math.ceil(Math.max(0, remaining))}s`;
  }
}
