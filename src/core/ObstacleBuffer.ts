export interface ObstacleSource {
  pool: { alive: Int32Array; liveCount: number };
  posX: Float32Array;
  posZ: Float32Array;
  radius: Float32Array;
}

/**
 * Flat x/z/radius buffer rebuilt each frame from every structure field, so
 * EnemyField can treat "what's solid" generically without importing
 * TowerField/WallField/etc. directly (avoids a circular/fan-out dependency
 * as more structure types are added).
 */
export class ObstacleBuffer {
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly radius: Float32Array;
  count = 0;

  constructor(capacity: number) {
    this.x = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.radius = new Float32Array(capacity);
  }

  rebuild(sources: readonly ObstacleSource[]): void {
    this.count = 0;
    for (const src of sources) {
      const alive = src.pool.alive;
      const n = src.pool.liveCount;
      for (let i = 0; i < n && this.count < this.x.length; i++) {
        const idx = alive[i];
        this.x[this.count] = src.posX[idx];
        this.z[this.count] = src.posZ[idx];
        this.radius[this.count] = src.radius[idx];
        this.count++;
      }
    }
  }
}
