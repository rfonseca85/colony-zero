import type { PlayerInputState } from '@/entities/Player';

const KEY_MAP: Record<string, keyof PlayerInputState> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'fire',
};

export class InputManager {
  readonly state: PlayerInputState = { up: false, down: false, left: false, right: false, fire: false };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const field = KEY_MAP[e.code];
    if (!field) return;
    if (e.code === 'Space') e.preventDefault(); // avoid page scroll + re-triggering a focused button (e.g. Start Wave)
    this.state[field] = true;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const field = KEY_MAP[e.code];
    if (field) this.state[field] = false;
  };

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
