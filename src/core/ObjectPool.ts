/**
 * Index-based object pool. No entity objects are allocated at all — callers
 * own flat typed arrays keyed by index, and this class only manages which
 * indices are "alive" vs free. acquire()/release() never allocate.
 */
export class ObjectPool {
  readonly capacity: number;
  private freeList: Int32Array;
  private freeTop: number; // points past the last free index
  private aliveFlags: Uint8Array;
  private aliveIndices: Int32Array; // dense list of currently-alive indices
  private aliveCount = 0;
  private slotToAlivePos: Int32Array; // index -> position within aliveIndices

  constructor(capacity: number) {
    this.capacity = capacity;
    this.freeList = new Int32Array(capacity);
    this.aliveFlags = new Uint8Array(capacity);
    this.aliveIndices = new Int32Array(capacity);
    this.slotToAlivePos = new Int32Array(capacity);
    for (let i = 0; i < capacity; i++) this.freeList[i] = capacity - 1 - i;
    this.freeTop = capacity;
  }

  get liveCount(): number {
    return this.aliveCount;
  }

  /** Dense array of currently-alive indices; only the first liveCount entries are valid. */
  get alive(): Int32Array {
    return this.aliveIndices;
  }

  acquire(): number {
    if (this.freeTop === 0) return -1; // pool exhausted; caller decides policy
    const idx = this.freeList[--this.freeTop];
    this.aliveFlags[idx] = 1;
    this.slotToAlivePos[idx] = this.aliveCount;
    this.aliveIndices[this.aliveCount] = idx;
    this.aliveCount++;
    return idx;
  }

  release(idx: number): void {
    if (this.aliveFlags[idx] === 0) return;
    this.aliveFlags[idx] = 0;

    const pos = this.slotToAlivePos[idx];
    const lastPos = this.aliveCount - 1;
    const lastIdx = this.aliveIndices[lastPos];
    this.aliveIndices[pos] = lastIdx;
    this.slotToAlivePos[lastIdx] = pos;
    this.aliveCount = lastPos;

    this.freeList[this.freeTop++] = idx;
  }

  isAlive(idx: number): boolean {
    return this.aliveFlags[idx] === 1;
  }

  releaseAll(): void {
    while (this.aliveCount > 0) this.release(this.aliveIndices[0]);
  }
}
