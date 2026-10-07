import * as THREE from 'three/webgpu';

export function createGround(size = 200): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(size, size, 1, 1);
  const material = new THREE.MeshStandardNodeMaterial({ color: 0x2b3a2f });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;

  const grid = new THREE.GridHelper(size, size / 2, 0x3f5443, 0x33442f);
  mesh.add(grid);
  (grid as THREE.GridHelper).position.y = 0.01;

  return mesh;
}
