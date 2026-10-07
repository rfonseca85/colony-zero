import { ObstacleSource } from '@/core/ObstacleBuffer';

/** Central list of "solid" structure fields — anything registered here blocks enemy movement via ObstacleBuffer. */
export class StructureRegistry {
  readonly sources: ObstacleSource[] = [];

  register(source: ObstacleSource): void {
    this.sources.push(source);
  }
}
