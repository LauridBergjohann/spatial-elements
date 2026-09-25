import type * as THREE from 'three/webgpu';
import type { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import type { LiquidGlassPanel, LiquidGlassPanelOptions } from './LiquidGlassPanel.js';
import type { StagePanelSurface } from './stageTypes.js';
import type { CatalogTransitionGroup } from '../catalog/catalogPresentation.js';
export interface StagePanelRuntime {
	content?: CSS3DObject;
	contentProjectionRoot?: THREE.Group;
	domRenderMode: 'native' | 'spatial';
	glass?: LiquidGlassPanel;
	group: THREE.Group;
	nativeRestFrames: number;
	options: Required<LiquidGlassPanelOptions>;
	pointerLift: number;
	pointerReactive: boolean;
	projectionRoot?: THREE.Group;
	surface: StagePanelSurface;
	transitionGroup?: CatalogTransitionGroup;
}
