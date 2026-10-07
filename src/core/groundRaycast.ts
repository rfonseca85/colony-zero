import * as THREE from 'three/webgpu';

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

/** Raycasts a mouse event against the y=0 ground plane in world space. Returns false if the ray is parallel to the plane. */
export function raycastGround(e: MouseEvent, container: HTMLElement, camera: THREE.Camera, out: THREE.Vector3): boolean {
  const rect = container.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.intersectPlane(GROUND_PLANE, out) !== null;
}
