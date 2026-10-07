import * as THREE from 'three/webgpu';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface VATClipInfo {
  startRow: number;
  frameCount: number;
  duration: number;
}

export interface VATBakeResult {
  texture: THREE.DataTexture;
  width: number; // vertex count (must match the render geometry's vertex count/order)
  height: number; // total rows across all baked clips
  clips: Record<string, VATClipInfo>;
  /**
   * Flat xyz positions (unscaled, same vertex order as `parts`) at the
   * first frame of the first clip — NOT the rig's raw bind/T-pose. Use
   * these as the static render geometry's position attribute so the mesh's
   * resting shape matches the VAT's zero-delta point; see the class doc.
   */
  referencePositions: Float32Array;
}

/**
 * Bakes a set of animation clips into a per-vertex position-delta texture
 * by replaying each clip through the real skeleton via
 * `SkinnedMesh.applyBoneTransform` — three.js's own CPU skinning path, not
 * hand-derived matrix math — rather than an AnimationMixer/SkinnedMesh per
 * enemy instance, which doesn't scale to thousands of instances. Bakes
 * each body part using ITS OWN original bindMatrix (from GLTFLoader)
 * rather than a merged temp mesh with a default identity bind, to avoid a
 * subtle bind-space mismatch. `parts` must be the exact same ordered list
 * used to build the render geometry (see collectBodyParts) so vertex
 * indices line up between the two.
 *
 * Deltas are stored relative to the FIRST baked frame (referencePositions),
 * not the rig's raw bind pose. This matters: this character's bind pose is
 * a T-pose (arms straight out), while every animation clip starts from a
 * relaxed stance — a hand vertex alone can be ~0.7 units from its bind
 * position just from that one-time pose difference, which swamps the
 * genuinely small per-frame motion an additive-delta shader is built to
 * handle, producing a visibly broken result once instance scale amplifies
 * it. Rebasing to an actual animated reference frame keeps every stored
 * delta small and physically meaningful. Call once at load time, never per
 * frame.
 */
export function bakeVAT(gltf: GLTF, parts: readonly THREE.Mesh[], clipNames: readonly string[], framesPerClip: number): VATBakeResult {
  const skinnedParts = parts.filter((m): m is THREE.SkinnedMesh => (m as THREE.SkinnedMesh).isSkinnedMesh === true);
  if (skinnedParts.length !== parts.length) {
    throw new Error('bakeVAT: every part must be a SkinnedMesh');
  }

  let vertexCount = 0;
  for (const mesh of skinnedParts) vertexCount += mesh.geometry.attributes.position.count;

  const mixer = new THREE.AnimationMixer(gltf.scene);
  const height = framesPerClip * clipNames.length;
  const data = new Float32Array(vertexCount * height * 4);
  const referencePositions = new Float32Array(vertexCount * 3);
  const clipMeta: Record<string, VATClipInfo> = {};

  const v = new THREE.Vector3();
  let row = 0;
  let haveReference = false;

  for (const name of clipNames) {
    const clip = gltf.animations.find((c) => c.name === name);
    if (!clip) throw new Error(`bakeVAT: clip "${name}" not found`);
    clipMeta[name] = { startRow: row, frameCount: framesPerClip, duration: clip.duration };

    const action = mixer.clipAction(clip);

    for (let f = 0; f < framesPerClip; f++) {
      const t = (clip.duration * f) / framesPerClip;
      mixer.stopAllAction();
      action.play();
      action.time = t;
      mixer.update(0);
      gltf.scene.updateMatrixWorld(true);

      const rowOffset = row * vertexCount * 4;
      let vertexOffset = 0;
      for (const mesh of skinnedParts) {
        mesh.skeleton.update();
        const posAttr = mesh.geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          v.fromBufferAttribute(posAttr, i);
          mesh.applyBoneTransform(i, v);

          const vi = vertexOffset + i;
          if (!haveReference) {
            referencePositions[vi * 3] = v.x;
            referencePositions[vi * 3 + 1] = v.y;
            referencePositions[vi * 3 + 2] = v.z;
          }

          const o = rowOffset + vi * 4;
          data[o] = v.x - referencePositions[vi * 3];
          data[o + 1] = v.y - referencePositions[vi * 3 + 1];
          data[o + 2] = v.z - referencePositions[vi * 3 + 2];
          data[o + 3] = 0;
        }
        vertexOffset += posAttr.count;
      }
      haveReference = true;
      row++;
    }
  }

  mixer.stopAllAction();

  const texture = new THREE.DataTexture(data, vertexCount, height, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return { texture, width: vertexCount, height, clips: clipMeta, referencePositions };
}

/** Multiplies every stored delta by `scale` in place — call once, after scaleGeometryToHeight tells you the final baked-geometry scale factor. */
export function scaleVATDeltas(result: VATBakeResult, scale: number): void {
  const data = result.texture.image.data as Float32Array;
  for (let i = 0; i < data.length; i += 4) {
    data[i] *= scale;
    data[i + 1] *= scale;
    data[i + 2] *= scale;
  }
  result.texture.needsUpdate = true;
}
