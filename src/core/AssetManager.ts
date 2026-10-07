import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Static GLTF cache. Load everything up front via preload() (awaited once,
 * early in main()) so every downstream entity constructor can read models
 * synchronously via get() — keeps Player/TowerField construction ordinary
 * and allocation-free rather than threading async/await through the whole
 * object graph.
 */
export class AssetManager {
  private static loader = new GLTFLoader();
  private static cache = new Map<string, GLTF>();

  static async preload(urls: readonly string[]): Promise<void> {
    await Promise.all(
      urls.map(
        (url) =>
          new Promise<void>((resolve, reject) => {
            this.loader.load(
              url,
              (gltf) => {
                this.cache.set(url, gltf);
                resolve();
              },
              undefined,
              reject,
            );
          }),
      ),
    );
  }

  /** Only valid for a URL already resolved by preload(). */
  static get(url: string): GLTF {
    const gltf = this.cache.get(url);
    if (!gltf) throw new Error(`AssetManager: "${url}" was not preloaded`);
    return gltf;
  }
}

/** Character models used in Phase 1 — Player and Tower share this rig, including every pre-attached weapon variant. */
export const MODEL_URLS = {
  soldier: '/models/Characters/glTF/Character_Soldier.gltf',
  hazmat: '/models/Characters/glTF/Character_Hazmat.gltf',
  enemy: '/models/Characters/glTF/Character_Enemy.gltf',
} as const;

/**
 * Every weapon the character rig ships with, each already parented and
 * positioned at the correct hand bone by the source asset — selecting a
 * weapon is just toggling visibility among these siblings, never
 * re-parenting or offsetting anything by hand.
 */
export const WEAPON_NODE_NAMES = [
  'AK',
  'GrenadeLauncher',
  'Knife_1',
  'Knife_2',
  'Pistol',
  'Revolver',
  'Revolver_Small',
  'RocketLauncher',
  'ShortCannon',
  'Shotgun',
  'Shovel',
  'SMG',
  'Sniper',
  'Sniper_2',
] as const;

export type WeaponName = (typeof WEAPON_NODE_NAMES)[number];
