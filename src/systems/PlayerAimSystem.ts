import * as THREE from 'three/webgpu';
import { raycastGround } from '@/core/groundRaycast';

const hitPoint = new THREE.Vector3();

/** Tracks where the mouse points on the ground plane, continuously (not gated by build mode). */
export class PlayerAimSystem {
  worldX = 0;
  worldZ = 0;
  hasAim = false;

  constructor(
    private container: HTMLElement,
    private camera: THREE.OrthographicCamera,
  ) {
    this.container.addEventListener('mousemove', this.onMouseMove);
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!raycastGround(e, this.container, this.camera, hitPoint)) return;
    this.worldX = hitPoint.x;
    this.worldZ = hitPoint.z;
    this.hasAim = true;
  };

  dispose(): void {
    this.container.removeEventListener('mousemove', this.onMouseMove);
  }
}
