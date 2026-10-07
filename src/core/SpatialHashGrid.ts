/**
 * Flat spatial hash grid over the XZ plane. Buckets are a head-pointer array
 * plus a per-entity "next" array (classic linked-list-in-array scheme), so
 * rebuilding each frame costs O(n) with zero allocation. Queries write into
 * a caller-supplied output array to stay allocation-free too.
 */
export class SpatialHashGrid {
  private cellSize: number;
  private cols: number;
  private rows: number;
  private originX: number;
  private originZ: number;
  private heads: Int32Array; // cell -> first entity index, or -1
  private next: Int32Array; // entity index -> next entity index in same cell, or -1

  constructor(worldWidth: number, worldDepth: number, cellSize: number, maxEntities: number) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldWidth / cellSize);
    this.rows = Math.ceil(worldDepth / cellSize);
    this.originX = -worldWidth / 2;
    this.originZ = -worldDepth / 2;
    this.heads = new Int32Array(this.cols * this.rows).fill(-1);
    this.next = new Int32Array(maxEntities).fill(-1);
  }

  private cellOf(x: number, z: number): number {
    let cx = Math.floor((x - this.originX) / this.cellSize);
    let cz = Math.floor((z - this.originZ) / this.cellSize);
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cz < 0) cz = 0;
    else if (cz >= this.rows) cz = this.rows - 1;
    return cz * this.cols + cx;
  }

  clear(): void {
    this.heads.fill(-1);
  }

  insert(entityIndex: number, x: number, z: number): void {
    const cell = this.cellOf(x, z);
    this.next[entityIndex] = this.heads[cell];
    this.heads[cell] = entityIndex;
  }

  /**
   * Fills `out` (an Int32Array) with entity indices within `radius` of (x, z).
   * Returns the count written. Caller must size `out` generously; writes stop
   * at out.length to stay allocation-free.
   */
  queryRadius(x: number, z: number, radius: number, out: Int32Array): number {
    const minCx = Math.max(0, Math.floor((x - radius - this.originX) / this.cellSize));
    const maxCx = Math.min(this.cols - 1, Math.floor((x + radius - this.originX) / this.cellSize));
    const minCz = Math.max(0, Math.floor((z - radius - this.originZ) / this.cellSize));
    const maxCz = Math.min(this.rows - 1, Math.floor((z + radius - this.originZ) / this.cellSize));

    let count = 0;
    for (let cz = minCz; cz <= maxCz; cz++) {
      const rowBase = cz * this.cols;
      for (let cx = minCx; cx <= maxCx; cx++) {
        let e = this.heads[rowBase + cx];
        while (e !== -1 && count < out.length) {
          out[count++] = e;
          e = this.next[e];
        }
      }
    }
    return count;
  }
}
