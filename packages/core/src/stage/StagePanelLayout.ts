import * as THREE from 'three/webgpu';
import { resolveLiquidGlassPanelOptions, type LiquidGlassPanelOptions } from './LiquidGlassPanel.js';

/**
 * Shared transform and dimensions for a CSS panel and its foreground overlays.
 *
 * This intentionally owns no renderable geometry: panel surfaces live in CSS,
 * while the group remains the common Three.js transform used by minimap math.
 */
export class StagePanelLayout {
	readonly group = new THREE.Group();
	readonly options: Required<LiquidGlassPanelOptions>;

	constructor(options: LiquidGlassPanelOptions = {}) {
		this.options = resolveLiquidGlassPanelOptions(options);
		this.group.position.set(this.options.position.x, this.options.position.y, 0);
	}

	dispose() {
		this.group.removeFromParent();
	}
}
