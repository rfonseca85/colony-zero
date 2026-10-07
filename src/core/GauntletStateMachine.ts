export const enum GauntletState {
  Hub = 'HUB',
  Planning = 'PLANNING',
  Action = 'ACTION',
  Resolution = 'RESOLUTION',
}

export type GauntletEvent =
  | { type: 'START_RUN' }
  | { type: 'BEGIN_WAVE' }
  | { type: 'PLAYER_DIED' }
  | { type: 'WAVE_CLEARED' }
  | { type: 'RETURN_TO_HUB' };

type Listener = (next: GauntletState, prev: GauntletState) => void;

/**
 * Hub -> Planning -> Action -> Resolution -> Hub. Planning is the pre-wave
 * build phase: the map is open, no enemies are present, and the player
 * places structures and buys run-only perks before committing to the timed
 * wave. Transitions are table-driven so illegal jumps are impossible.
 */
export class GauntletStateMachine {
  private state: GauntletState = GauntletState.Hub;
  private listeners: Listener[] = [];

  private readonly transitions: Record<GauntletState, Partial<Record<GauntletEvent['type'], GauntletState>>> = {
    [GauntletState.Hub]: {
      START_RUN: GauntletState.Planning,
    },
    [GauntletState.Planning]: {
      BEGIN_WAVE: GauntletState.Action,
    },
    [GauntletState.Action]: {
      PLAYER_DIED: GauntletState.Resolution,
      WAVE_CLEARED: GauntletState.Resolution,
    },
    [GauntletState.Resolution]: {
      RETURN_TO_HUB: GauntletState.Hub,
    },
  };

  get current(): GauntletState {
    return this.state;
  }

  onChange(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i !== -1) this.listeners.splice(i, 1);
    };
  }

  dispatch(event: GauntletEvent): boolean {
    const next = this.transitions[this.state][event.type];
    if (next === undefined) {
      console.warn(`[Gauntlet] Illegal transition: ${event.type} from ${this.state}`);
      return false;
    }
    const prev = this.state;
    this.state = next;
    for (const l of this.listeners) l(next, prev);
    return true;
  }
}
