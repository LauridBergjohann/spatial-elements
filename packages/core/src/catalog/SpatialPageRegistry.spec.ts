import { expect, test } from 'vitest';
import { SpatialPageRegistry, type SpatialPage } from './SpatialPageRegistry.js';

test('destination ownership survives late cleanup of the outgoing page', () => {
	let read: (() => SpatialPage) | undefined;
	const pages = new SpatialPageRegistry((next) => {
		read = next;
	});
	const releaseSource = pages.register(() => ({ kind: 'content', hdr: '/category.hdr' }));
	let element = {
		id: 'first',
		title: 'First',
		geometry: { low: '/first.glb', high: '/first.glb' },
		hdr: '/studio.hdr'
	};
	const releaseTarget = pages.register(() => ({ kind: 'detail', element }));
	releaseSource();
	expect(read?.()).toEqual({ kind: 'detail', element });
	element = { ...element, id: 'second' };
	expect(read?.()).toEqual({ kind: 'detail', element });
	releaseTarget();
	expect(read).toBeUndefined();
});

test('page registrations stay isolated between shells', () => {
	let first: (() => SpatialPage) | undefined;
	let second: (() => SpatialPage) | undefined;
	new SpatialPageRegistry((next) => {
		first = next;
	}).register(() => ({ kind: 'content', hdr: '/category.hdr' }));
	const release = new SpatialPageRegistry((next) => {
		second = next;
	}).register(() => ({ kind: 'content', hdr: '/category.hdr' }));
	release();
	expect(first?.().kind).toBe('content');
	expect(second).toBeUndefined();
});
