import type * as THREE from 'three';

export interface Collider { x: number; z: number; halfX: number; halfZ: number; }
export interface WalkArea { x: number; z: number; halfX: number; halfZ: number; }
export type InteractionKind = 'books' | 'latest' | 'projects' | 'about' | 'lantern' | 'bench';
export interface Interaction {
  id: string;
  kind: InteractionKind;
  position: THREE.Vector3;
  approach: THREE.Vector3;
  radius: number;
  label: string;
  labelEn: string;
  meshes: THREE.Object3D[];
  activate?: () => void;
  sitPosition?: THREE.Vector3;
  sitYaw?: number;
}
export interface Environment {
  root: THREE.Group;
  colliders: Collider[];
  walkAreas: WalkArea[];
  roofOccluders: THREE.Object3D[];
  assetsReady: Promise<void>;
  update: (time: number, delta: number, indoor: boolean) => void;
  dispose: () => void;
}
export interface Furnishings {
  root: THREE.Group;
  colliders: Collider[];
  interactions: Interaction[];
  /** Local decorative image loading; the scene is usable immediately with a canvas fallback. */
  assetsReady: Promise<void>;
  update: (time: number, delta: number, selectedId: string | null) => void;
  dispose: () => void;
}
export interface WorldConfig {
  isEn: boolean;
  prefix: string;
  base: string;
}
export interface WorldUI {
  updateWaymarks: (camera: THREE.PerspectiveCamera, items: Interaction[], aimed?: string) => void;
  useCentredWaymark: () => void;
  setSound: (enabled: boolean) => void;
  setReady: () => void;
  setFailed: (reason: string) => void;
  setLocation: (name: string, nameEn: string) => void;
  setInteraction: (interaction: Interaction | null, screen?: { x: number; y: number }) => void;
  showToast: (text: string) => void;
  openContent: (kind: InteractionKind, catalogue?: boolean) => void;
  isOpen: () => boolean;
  dispose: () => void;
}
