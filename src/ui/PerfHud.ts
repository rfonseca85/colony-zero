export class PerfHud {
  private el: HTMLDivElement;
  private frames = 0;
  private fpsTimer = 0;
  private fps = 0;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute; top: 10px; left: 10px; z-index: 10;
      font: 12px/1.5 'SF Mono', Menlo, monospace; color: #bfe6cf;
      background: rgba(10, 16, 13, 0.72); padding: 8px 12px; border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.08); pointer-events: none; white-space: pre;
    `;
    container.appendChild(this.el);
  }

  update(
    dt: number,
    enemyCount: number,
    projectileCount: number,
    state: string,
    structureCount: number,
    currency: number,
    placementMode: boolean,
  ): void {
    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.frames / this.fpsTimer);
      this.frames = 0;
      this.fpsTimer = 0;
    }
    const build = placementMode ? 'ON (LMB to place)' : 'off (B to toggle)';
    this.el.textContent = `FPS  ${this.fps}\nEnemies  ${enemyCount}\nProjectiles  ${projectileCount}\nStructures  ${structureCount}\nCurrency  ${currency}\nBuild mode  ${build}\nState  ${state}\n\nWASD move · mouse aim · SPACE fire · B build · 1-4 select structure · \` dev mode`;
  }
}
