import { MathUtils } from 'three';

export function snapDampedValue(value: number, target: number, epsilon = 0.01) {
	return Math.abs(value - target) <= epsilon ? target : value;
}

export function dampAndSnap(
	value: number,
	target: number,
	damping: number,
	delta: number,
	epsilon: number
) {
	return snapDampedValue(MathUtils.damp(value, target, damping, delta), target, epsilon);
}
