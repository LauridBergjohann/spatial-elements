/** Scalar helpers shared by native layout and the optional renderer. */
export const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));
export const lerp = (start: number, end: number, progress: number) =>
	(1 - progress) * start + progress * end;
export const degToRad = (degrees: number) => (degrees * Math.PI) / 180;
export const radToDeg = (radians: number) => (radians * 180) / Math.PI;
