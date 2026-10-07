import { expect, test } from 'vitest';
import { defaultSpatialMessages, resolveSpatialMessages } from './messages.js';

test('partial locale overrides retain English defaults, including explicit undefined', () => {
	const result = resolveSpatialMessages({ controls: { help: '3D-Steuerung', closeHelp: undefined }, interactionHelp: { rotate: 'Drehen' } });
	expect(result.controls).toEqual({ help: '3D-Steuerung', closeHelp: 'Close help', detailView: 'Detail view', fullscreen: 'Fullscreen' });
	expect(result.interactionHelp.rotate).toBe('Drehen');
	expect(result.interactionHelp.mouseRotate).toBe(defaultSpatialMessages.interactionHelp.mouseRotate);
	expect(result.interactionHelp.mouseNavigationHint).toBe('Alternatively, use a {spacemouse} to navigate.');
	expect(defaultSpatialMessages.controls.help).toBe('3D controls');
	result.interactionHelp.zoom = 'Changed';
	expect(resolveSpatialMessages().interactionHelp.zoom).toBe('Zoom');
});

test('view switch tooltips can be localized independently', () => {
	expect(resolveSpatialMessages({ controls: { detailView: 'Detailansicht', fullscreen: 'Vollbild' } }).controls)
		.toEqual({ help: '3D controls', closeHelp: 'Close help', detailView: 'Detailansicht', fullscreen: 'Vollbild' });
});
