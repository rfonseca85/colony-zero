// @types/three does not yet cover the `three/webgpu` and `three/tsl`
// subpath exports (WebGPURenderer + TSL node materials). These thin shims
// type just the surface this project uses; widen as new APIs are adopted.
declare module 'three/webgpu' {
  export * from 'three';

  import { WebGLRendererParameters, Scene, Camera, Material } from 'three';

  export interface WebGPURendererParameters extends Partial<WebGLRendererParameters> {
    antialias?: boolean;
  }

  export class WebGPURenderer {
    domElement: HTMLCanvasElement;
    constructor(parameters?: WebGPURendererParameters);
    init(): Promise<void>;
    setPixelRatio(ratio: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    render(scene: Scene, camera: Camera): void;
    setAnimationLoop(callback: ((time: number) => void) | null): void;
    dispose(): void;
  }

  export class MeshStandardNodeMaterial extends Material {
    constructor(parameters?: Record<string, unknown>);
    color: { set(v: number | string): void };
    vertexColors: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    positionNode: any;
  }

  export class MeshBasicNodeMaterial extends Material {
    constructor(parameters?: Record<string, unknown>);
    color: { set(v: number | string): void };
    vertexColors: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    positionNode: any;
  }
}

// TSL (Three.js Shading Language) — a thin shim covering only the node
// builder surface this project uses (procedural vertex animation for the
// enemy horde). Node objects are chainable and loosely typed on purpose;
// the real TSL type graph is far more elaborate than is worth modeling here.
declare module 'three/tsl' {
  import { InstancedBufferAttribute, BufferAttribute, Texture } from 'three';

  export interface TSLNode {
    add(v: TSLNode | number): TSLNode;
    sub(v: TSLNode | number): TSLNode;
    mul(v: TSLNode | number): TSLNode;
    div(v: TSLNode | number): TSLNode;
    negate(): TSLNode;
    sin(): TSLNode;
    cos(): TSLNode;
    floor(): TSLNode;
    toVar(name?: string): TSLNode;
    readonly x: TSLNode;
    readonly y: TSLNode;
    readonly z: TSLNode;
    readonly w: TSLNode;
    readonly xyz: TSLNode;
  }

  export const positionLocal: TSLNode;
  export const positionGeometry: TSLNode;
  export const positionWorld: TSLNode;
  export const normalLocal: TSLNode;
  export const time: TSLNode;
  export const instanceIndex: TSLNode;
  export const vertexIndex: TSLNode;

  export function sin(v: TSLNode | number): TSLNode;
  export function cos(v: TSLNode | number): TSLNode;
  export function floor(v: TSLNode | number): TSLNode;
  export function mod(a: TSLNode | number, b: TSLNode | number): TSLNode;
  export function float(v: number | TSLNode): TSLNode;
  export function int(v: number | TSLNode): TSLNode;
  export function uint(v: number | TSLNode): TSLNode;
  export function vec2(...args: Array<number | TSLNode>): TSLNode;
  export function vec3(...args: Array<number | TSLNode>): TSLNode;
  export function vec4(...args: Array<number | TSLNode>): TSLNode;
  export function ivec2(...args: Array<number | TSLNode>): TSLNode;
  export function ivec3(...args: Array<number | TSLNode>): TSLNode;
  export function mix(a: TSLNode | number, b: TSLNode | number, t: TSLNode | number): TSLNode;
  export function rotate(position: TSLNode, rotation: TSLNode): TSLNode;
  export function attribute(name: string, type?: string): TSLNode;
  export function instancedBufferAttribute(
    attr: InstancedBufferAttribute | BufferAttribute,
    type?: string,
    stride?: number,
    offset?: number,
  ): TSLNode;
  export function instancedDynamicBufferAttribute(
    attr: InstancedBufferAttribute | BufferAttribute,
    type?: string,
    stride?: number,
    offset?: number,
  ): TSLNode;
  export function uniform(value: number | TSLNode): TSLNode;
  export function texture(tex: Texture, uv?: TSLNode): TSLNode;
  export function textureLoad(tex: Texture, uv?: TSLNode): TSLNode;
}
