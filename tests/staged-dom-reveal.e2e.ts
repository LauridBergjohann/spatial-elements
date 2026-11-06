import { expect, test } from '@playwright/test';

// Exercise the shipped CSS itself without a renderer or another animation clock.
test.use({ javaScriptEnabled: false });

test('local reveal does not inherit into content, but panel pseudos retain theme and focus factors', async ({ page }) => {
	await page.goto('/demo/elements/column');
	const result = await page.evaluate(() => {
		const property = '--catalog-reveal-opacity';
		const stage = document.querySelector<HTMLElement>('.stage')!;
		const frame = document.querySelector<HTMLElement>('.spatial-element-panel')!;
		const surface = frame.querySelector<HTMLElement>('[data-stage-panel-css-surface]')!;
		const content = frame.querySelector<HTMLElement>('[data-stage-panel-content]')!;
		const text = document.createElement('span'); content.append(text);
		stage.style.setProperty('--catalog-shared-opacity', '.6');
		content.style.setProperty('--stage-panel-opacity', '.8');
		content.style.setProperty('--stage-panel-content-opacity', '.5');
		surface.style.setProperty('--stage-panel-opacity', '.8');
		surface.style.setProperty('--stage-panel-surface-opacity', '.7');
		surface.style.setProperty('--stage-panel-focus-opacity', '.5');
		surface.style.setProperty('--stage-panel-specular-opacity', '.3');
		const read = () => ({
			content: Number(getComputedStyle(content).opacity),
			surface: Number(getComputedStyle(surface).opacity),
			before: Number(getComputedStyle(surface, '::before').opacity),
			after: Number(getComputedStyle(surface, '::after').opacity),
			beforeLocal: getComputedStyle(surface, '::before').getPropertyValue(property).trim(),
			afterLocal: getComputedStyle(surface, '::after').getPropertyValue(property).trim(),
			textLocal: getComputedStyle(text).getPropertyValue(property).trim()
		});
		const ordinary = read();
		content.style.setProperty(property, '.25'); surface.style.setProperty(property, '.25');
		const revealing = read();
		content.style.removeProperty(property); surface.style.removeProperty(property);
		return { ordinary, revealing, restored: read() };
	});
	expect(result.ordinary.content).toBeCloseTo(.8 * .5 * .6, 6);
	expect(result.ordinary.before).toBeCloseTo(.8 * .7 * .5 * .6, 6);
	expect(result.ordinary.after).toBeCloseTo(.8 * .7 * .5 * .3 * .6, 6);
	expect(result.revealing.content).toBeCloseTo(.8 * .5 * .25, 6);
	expect(result.revealing.before).toBeCloseTo(.8 * .7 * .5 * .25, 6);
	expect(result.revealing.after).toBeCloseTo(.8 * .7 * .5 * .3 * .25, 6);
	expect(result.revealing.surface).toBe(1);
	expect(Number(result.revealing.beforeLocal)).toBe(.25);
	expect(Number(result.revealing.afterLocal)).toBe(.25);
	expect(result.revealing.textLocal).toBe('');
	expect(result.restored).toEqual(result.ordinary);
});

test('ordinary DOM and nested incoming groups preserve their separate factors and fallback after removal', async ({ page }) => {
	await page.goto('/demo/elements/column');
	const result = await page.evaluate(() => {
		const property = '--catalog-reveal-opacity';
		const stage = document.querySelector<HTMLElement>('.stage')!;
		stage.dataset.catalogTransition = 'holding';
		stage.style.setProperty('--catalog-enter-opacity', '.6');
		stage.style.setProperty('--stage-dom-opacity', '.4');
		const outer = document.createElement('article');
		outer.dataset.catalogTransitionDom = 'enter'; outer.dataset.stageDomContent = '';
		const inner = document.createElement('div'); inner.dataset.catalogTransitionDom = 'enter';
		const text = document.createElement('span'); inner.append(text); outer.append(inner); stage.append(outer);
		const read = () => ({ outer: Number(getComputedStyle(outer).opacity), inner: Number(getComputedStyle(inner).opacity),
			innerLocal: getComputedStyle(inner).getPropertyValue(property).trim(), textLocal: getComputedStyle(text).getPropertyValue(property).trim() });
		const ordinary = read();
		outer.style.setProperty(property, '.25');
		const outerOnly = read();
		inner.style.setProperty(property, '.5');
		const nested = read();
		outer.style.removeProperty(property); inner.style.removeProperty(property);
		return { ordinary, outerOnly, nested, restored: read() };
	});
	expect(result.ordinary.outer).toBeCloseTo(.4 * .6, 6);
	expect(result.ordinary.inner).toBeCloseTo(.6, 6);
	expect(result.outerOnly.outer).toBeCloseTo(.4 * .25, 6);
	expect(result.outerOnly.inner).toBeCloseTo(.6, 6);
	expect(result.outerOnly.innerLocal).toBe('');
	expect(result.nested.outer).toBeCloseTo(.1, 6);
	expect(result.nested.inner).toBeCloseTo(.5, 6);
	expect(result.nested.textLocal).toBe('');
	expect(result.restored).toEqual(result.ordinary);
});
