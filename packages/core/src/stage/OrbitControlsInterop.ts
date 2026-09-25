import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Recreates OrbitControls at the current camera pose before external navigation.
 * OrbitControls has no public API for clearing its damped rotation/pan deltas;
 * replacing the instance prevents those deltas from leaking into SpaceMouse frames.
 */
export function recreateOrbitControlsForExternalNavigation<TControls extends OrbitControls>(
	previous: TControls,
	createControls: () => TControls
) {
	const target = previous.target.clone();
	const minDistance = previous.minDistance;
	const maxDistance = previous.maxDistance;
	previous.dispose();

	const controls = createControls();
	controls.target.copy(target);
	controls.minDistance = minDistance;
	controls.maxDistance = maxDistance;
	controls.update();
	controls.saveState();
	return controls;
}
