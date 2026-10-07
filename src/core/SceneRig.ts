import * as THREE from 'three/webgpu';

/**
 * Owns the renderer, scene, and the fixed isometric/top-down orthographic
 * camera. Resize is the only place allowed to touch camera frustum math
 * outside of init — everything else treats the rig as read-only per frame.
 */
export class SceneRig {
  readonly renderer: THREE.WebGPURenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;

  private viewSize = 40; // world units visible vertically
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGPURenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1f1c);
    this.scene.fog = new THREE.Fog(0x1a1f1c, 60, 140);

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.OrthographicCamera(
      (-this.viewSize * aspect) / 2,
      (this.viewSize * aspect) / 2,
      this.viewSize / 2,
      -this.viewSize / 2,
      0.1,
      500,
    );
    // Top-down isometric-ish angle: elevated and pulled back, looking at origin.
    this.camera.position.set(0, 34, 24);
    this.camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xcfe8d8, 0x30261a, 1.1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(20, 40, 10);
    this.scene.add(sun);

    window.addEventListener('resize', this.onResize);
  }

  /** Follows a target on the XZ plane while preserving the fixed camera angle/zoom. */
  follow(targetX: number, targetZ: number): void {
    this.camera.position.set(targetX, 34, targetZ + 24);
    this.camera.lookAt(targetX, 0, targetZ);
  }

  async init(): Promise<void> {
    await this.renderer.init();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private onResize = (): void => {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.left = (-this.viewSize * aspect) / 2;
    this.camera.right = (this.viewSize * aspect) / 2;
    this.camera.top = this.viewSize / 2;
    this.camera.bottom = -this.viewSize / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  };

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
  }
}
