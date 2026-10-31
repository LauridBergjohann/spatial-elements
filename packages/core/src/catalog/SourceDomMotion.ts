import { Matrix4 } from 'three';
import { getProjectiveCssMatrix3d, type CssProjectionQuad } from '../stage/cssProjection.js';

export interface SourceDomProjection { width: number; height: number; corners: CssProjectionQuad }
export interface SourceDomTarget { left: number; top: number; width: number; height?: number }

export function sourceDomProjectiveMatrix(corners: CssProjectionQuad, width: number, height: number): number[] | undefined {
	const css = getProjectiveCssMatrix3d(corners, width, height);
	return css ? css.slice(9, -1).split(',').map(Number) : undefined;
}

function projectiveMatrix(corners: CssProjectionQuad, width: number, height: number) {
	const values = sourceDomProjectiveMatrix(corners, width, height);
	return values ? new Matrix4().fromArray(values) : undefined;
}

export function sourceDomMotionQuad(source: SourceDomProjection, target: SourceDomTarget, progress: number): CssProjectionQuad {
	const t = Math.min(1, Math.max(0, progress));
	const height = target.height ?? source.height * target.width / source.width;
	const end = [
		{ x: target.left, y: target.top }, { x: target.left + target.width, y: target.top },
		{ x: target.left + target.width, y: target.top + height }, { x: target.left, y: target.top + height }
	];
	return source.corners.map((point, index) => ({
		x: point.x + (end[index].x - point.x) * t,
		y: point.y + (end[index].y - point.y) * t
	})) as unknown as CssProjectionQuad;
}

/** A planar correction on the RIGHT of the original local CSS3D transform. */
export function createSourceDomProjection(source: SourceDomProjection, target: SourceDomTarget) {
	if (![source.width, source.height, target.width].every(value => Number.isFinite(value) && value > 0) ||
		![target.left, target.top].every(Number.isFinite)) return;
	const height = target.height ?? source.height * target.width / source.width;
	if (!Number.isFinite(height) || height <= 0) return;
	const start = projectiveMatrix(source.corners, source.width, source.height);
	if (!start || !Number.isFinite(start.determinant()) || Math.abs(start.determinant()) < 1e-12) return;
	const inverse = start.invert();
	return (progress: number) => {
		if (!Number.isFinite(progress)) return;
		const corners = sourceDomMotionQuad(source, target, progress);
		const current = projectiveMatrix(corners, source.width, source.height);
		return current ? inverse.clone().multiply(current) : undefined;
	};
}

const OWNED_PROPERTIES = [
	'transform', 'transform-origin', 'width', 'height', 'min-width', 'max-width',
	'min-height', 'max-height', 'box-sizing', 'transition', 'animation', 'will-change', 'visibility'
] as const;

/**
 * Moves the existing node in its existing parent. No node creation, removal,
 * reparenting, destination layout, or renderer work occurs during this motion.
 * Callers freeze competing transform writers and keep clipping ancestors stable.
 */
export function createSourceDomMotion(element: HTMLElement, source: SourceDomProjection, target: SourceDomTarget) {
	const project = createSourceDomProjection(source, target);
	if (!project) return;
	const computed = getComputedStyle(element);
	// Individual transform properties precede `transform`. Until captured as part
	// of the local matrix, authored use must keep the ordinary transition path.
	if ([computed.translate, computed.rotate, computed.scale].some(value => value && value !== 'none')) return;
	const origin = computed.transformOrigin.split(' ').map(Number.parseFloat);
	if (!Number.isFinite(origin[0]) || !Number.isFinite(origin[1])) return;
	const css = new DOMMatrix(computed.transform === 'none' ? undefined : computed.transform);
	const local = new Matrix4().makeTranslation(origin[0], origin[1], origin[2] || 0)
		.multiply(new Matrix4().fromArray(css.toFloat64Array()))
		.multiply(new Matrix4().makeTranslation(-origin[0], -origin[1], -(origin[2] || 0)));
	const saved = OWNED_PROPERTIES.map(property => ({ property,
		value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) }));
	const write = (property: string, value: string) => element.style.setProperty(property, value, 'important');
	// Freeze the captured border box, retaining the source's own query width and
	// line wrapping. Its later intrinsic destination height belongs to reveal.
	write('box-sizing', 'border-box');
	for (const property of ['width', 'min-width', 'max-width']) write(property, `${source.width}px`);
	for (const property of ['height', 'min-height', 'max-height']) write(property, `${source.height}px`);
	write('transition', 'none'); write('animation', 'none');
	write('transform-origin', '0px 0px 0px'); write('will-change', 'transform');
	let restored = false;
	const update = (progress: number) => {
		if (restored) return;
		const delta = project(progress);
		if (!delta) return;
		const matrix = local.clone().multiply(delta);
		write('transform', `matrix3d(${matrix.elements.map(value => Math.abs(value) < 1e-12 ? 0 : value).join(',')})`);
		return sourceDomMotionQuad(source, target, progress);
	};
	update(0);
	return {
		update,
		hide() { if (!restored) write('visibility', 'hidden'); },
		restore() {
			if (restored) return;
			restored = true;
			for (const { property, value, priority } of saved) {
				if (value) element.style.setProperty(property, value, priority);
				else element.style.removeProperty(property);
			}
		}
	};
}
