import * as THREE from 'three/webgpu';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { scaleToHeight, groundAlign, setActiveWeapon } from '@/core/ModelUtils';
import { WeaponName } from '@/core/AssetManager';

/**
 * One cloned, independently-animated instance of a skinned character GLTF.
 * Shared by Player and TowerField (Phase 1) so both get identical,
 * once-reviewed scaling/weapon/crossfade behavior instead of two divergent
 * copies. Cloning (not instancing) is deliberate: skinned mesh animation
 * needs its own Skeleton + AnimationMixer per instance, which only matters
 * here because tower capacity is small (dozens, not thousands) — enemies
 * stay on the InstancedMesh/placeholder path.
 */
export class AnimatedCharacter {
  readonly root: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;

  constructor(gltf: GLTF, targetHeight: number, weapon: WeaponName) {
    this.root = skeletonClone(gltf.scene);
    scaleToHeight(this.root, targetHeight);
    groundAlign(this.root);
    setActiveWeapon(this.root, weapon);

    this.mixer = new THREE.AnimationMixer(this.root);
    for (const clip of gltf.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
  }

  /** Crossfades to a looping action; no-op if it's already playing. */
  play(name: string, fadeSeconds = 0.15): void {
    const next = this.actions.get(name);
    if (!next || next === this.current) return;
    next.reset().fadeIn(fadeSeconds).play();
    this.current?.fadeOut(fadeSeconds);
    this.current = next;
  }

  /** Plays a one-shot action, then crossfades back to `returnTo` when it finishes — e.g. a fire animation that resolves back to Idle. */
  playOnce(name: string, returnTo: string, fadeSeconds = 0.1): void {
    const next = this.actions.get(name);
    if (!next || next === this.current) return;
    next.reset();
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    next.fadeIn(fadeSeconds).play();
    this.current?.fadeOut(fadeSeconds);
    this.current = next;

    const onFinished = (e: { action: THREE.AnimationAction }): void => {
      if (e.action !== next) return;
      this.mixer.removeEventListener('finished', onFinished);
      this.current = null; // force play() past the already-playing guard
      this.play(returnTo, fadeSeconds);
    };
    this.mixer.addEventListener('finished', onFinished);
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }
}
