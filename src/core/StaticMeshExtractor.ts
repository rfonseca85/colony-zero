import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function isUnderExcludedName(obj: THREE.Object3D, excludeNames: ReadonlySet<string>): boolean {
  let n: THREE.Object3D | null = obj;
  while (n) {
    if (excludeNames.has(n.name)) return true;
    n = n.parent;
  }
  return false;
}

/**
 * Flattens a multi-mesh, multi-material skinned character (18 SkinnedMesh
 * parts, 10 flat-color materials, no textures) into ONE static geometry
 * suitable for a single InstancedMesh draw call. Each part's flat material
 * color (or existing per-vertex color, if a part already has one) is baked
 * into a 'color' vertex attribute so a single `vertexColors: true` material
 * reproduces the original multi-colored look without per-part materials.
 * Skinning attributes are dropped — the result is a plain static mesh in
 * bind-pose shape, animated procedurally rather than via Skeleton/Mixer.
 * Call once at load time, never per frame.
 */
export function extractStaticColoredGeometry(root: THREE.Object3D, excludeNames: ReadonlySet<string> = new Set()): THREE.BufferGeometry {
  root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  const tmpColor = new THREE.Color();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (isUnderExcludedName(obj, excludeNames)) return;

    const src = mesh.geometry;
    const position = src.getAttribute('position');
    const normal = src.getAttribute('normal');
    if (!position || !normal) return; // shouldn't happen for this asset family, but skip defensively

    const part = new THREE.BufferGeometry();
    part.setAttribute('position', position.clone());
    part.setAttribute('normal', normal.clone());

    const existingColor = src.getAttribute('color');
    if (existingColor) {
      part.setAttribute('color', existingColor.clone());
    } else {
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const baseColor = (mat as THREE.MeshStandardMaterial | undefined)?.color ?? tmpColor.set(0xffffff);
      const count = position.count;
      const colorArr = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colorArr[i * 3] = baseColor.r;
        colorArr[i * 3 + 1] = baseColor.g;
        colorArr[i * 3 + 2] = baseColor.b;
      }
      part.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
    }

    part.applyMatrix4(mesh.matrixWorld);
    parts.push(part);
  });

  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('extractStaticColoredGeometry: mergeGeometries failed — check attribute consistency across parts');
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

/** Translates `geometry` in place so its bounding-box bottom sits at y=0 — mirrors ModelUtils.groundAlign but for a shared static geometry rather than a per-instance Object3D. */
export function groundAlignGeometry(geometry: THREE.BufferGeometry): void {
  geometry.computeBoundingBox();
  const minY = geometry.boundingBox!.min.y;
  geometry.translate(0, -minY, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

/** Uniformly scales `geometry` in place so its current bounding-box height becomes `targetHeight`. */
export function scaleGeometryToHeight(geometry: THREE.BufferGeometry, targetHeight: number): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const height = box.max.y - box.min.y;
  if (height <= 0) return;
  const scale = targetHeight / height;
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
