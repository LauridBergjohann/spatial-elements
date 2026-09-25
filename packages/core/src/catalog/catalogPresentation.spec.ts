import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import {
	applyCatalogMaterialOpacity,
	captureCatalogMaterialOpacity,
	getCatalogTransitionOpacity,
	normalizeCatalogPresentation,
	RESTING_CATALOG_PRESENTATION
} from './catalogPresentation.js';

describe('catalog presentation channels', () => {
	it('keeps navigation outside enter/shared groups and restores every channel on cancellation', () => {
		const active = normalizeCatalogPresentation({
			active: true,
			backgroundOpacity: 0,
			enterOpacity: 0.2,
			sharedOpacity: 0.6,
			exitOpacity: 0.1
		});
		expect(getCatalogTransitionOpacity(active, 'enter')).toBe(0.2);
		expect(active.backgroundOpacity).toBe(0);
		expect(getCatalogTransitionOpacity(active, 'shared')).toBe(0.6);
		expect(getCatalogTransitionOpacity(active)).toBe(1);
		expect(getCatalogTransitionOpacity(active, 'navigation')).toBe(1);
		expect(normalizeCatalogPresentation({ ...active, active: false })).toEqual(
			RESTING_CATALOG_PRESENTATION
		);
	});

	it('fails closed for invalid active alpha without allowing out-of-range material opacity', () => {
		expect(
			normalizeCatalogPresentation({
				active: true,
				enterOpacity: Number.NaN,
				sharedOpacity: -1,
				exitOpacity: 3
			})
		).toEqual({ active: true, enterOpacity: 0, sharedOpacity: 0, exitOpacity: 1 });
	});

	it('preserves authored transparency and shared material identity across repeated fade and restoration', () => {
		const solid = new MeshStandardMaterial({ opacity: 0.8 });
		const translucent = new MeshStandardMaterial({
			opacity: 0.35,
			transparent: true,
			depthWrite: false
		});
		const geometry = new BoxGeometry();
		const model = new Group();
		model.add(new Mesh(geometry, [solid, translucent]), new Mesh(geometry, solid));
		const states = captureCatalogMaterialOpacity(model);
		expect(states).toHaveLength(2);
		applyCatalogMaterialOpacity(states, 0.5);
		const solidVersion = solid.version;
		applyCatalogMaterialOpacity(states, 0.25);
		expect(solid.opacity).toBe(0.2);
		expect(translucent.opacity).toBe(0.0875);
		expect(solid.depthWrite).toBe(false);
		expect(solid.version).toBe(solidVersion);
		applyCatalogMaterialOpacity(states, 1);
		expect([solid.opacity, solid.transparent, solid.depthWrite]).toEqual([0.8, false, true]);
		expect([translucent.opacity, translucent.transparent, translucent.depthWrite]).toEqual([
			0.35,
			true,
			false
		]);
		geometry.dispose();
		solid.dispose();
		translucent.dispose();
	});
});
