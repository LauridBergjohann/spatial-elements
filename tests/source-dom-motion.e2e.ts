import { expect, test } from '@playwright/test';
type Point = { x: number; y: number };
type StageEvent = { kind: string; time: number; phase: string; progress?: number; expected?: Point[]; actual?: Point[]; mutations: number };
declare global { interface Window { sourceDomMotionProof: {
	start(): { source: { corners: Point[] }; after: Point[]; created: boolean };
	update(progress: number): { expected: Point[]; actual: Point[] };
	state(): { corners: Point[]; sameParent: boolean; connected: boolean; width: number; height: number; fontSize: string;
		focused: boolean; value: string; style: string; originalStyle: string; mutations: number };
	restore(): ReturnType<Window['sourceDomMotionProof']['state']>; hide(): void;
	startStaged(reduced?: boolean): boolean;
	stagedState(): { phase: string; events: StageEvent[]; mutations: number; corners: Point[]; inert: boolean; value: string };
	cancelStaged(): void; revealStaged(): Promise<void>;
} } }
const error = (actual: Point[], expected: Point[]) => Math.max(...actual.map((point, index) => Math.hypot(point.x - expected[index].x, point.y - expected[index].y)));

test('the same focused source node follows its viewport quad under a real CSS3D parent without DOM mutations or query reflow', async ({ page }, info) => {
	await page.goto('/tests/fixtures/source-dom-motion/');
	await page.getByRole('textbox').fill('edited before motion');
	const initial = await page.evaluate(() => window.sourceDomMotionProof.start());
	expect(initial.created).toBe(true);
	expect(error(initial.after, initial.source.corners)).toBeLessThan(0.05);
	for (const progress of [0.2, 0.5, 0.8, 1]) {
		const frame = await page.evaluate(progress => window.sourceDomMotionProof.update(progress), progress);
		expect(error(frame.actual, frame.expected)).toBeLessThan(0.05);
		const state = await page.evaluate(() => window.sourceDomMotionProof.state());
		expect(state).toMatchObject({ sameParent: true, connected: true, width: 280, height: 180, fontSize: '16px', focused: true, value: 'edited before motion', mutations: 0 });
	}
	await page.screenshot({ path: info.outputPath('endpoint.png') });
	await page.evaluate(() => window.sourceDomMotionProof.hide());
	const restored = await page.evaluate(() => window.sourceDomMotionProof.restore());
	expect(error(restored.corners, initial.source.corners)).toBeLessThan(0.05);
	// CSSStyleDeclaration normalizes whitespace; compare the owned declarations.
	expect(restored.style.replace(/\s/g, '')).toBe(restored.originalStyle.replace(/\s/g, '').replace(/;?$/, ';'));
	expect(restored).toMatchObject({ sameParent: true, connected: true, mutations: 0, value: 'edited before motion' });
});

test('the staged controller paints source motion before handoff and constructs new content only in reveal', async ({ page }) => {
	await page.goto('/tests/fixtures/source-dom-motion/');
	await page.getByRole('textbox').fill('retained across handoff');
	expect(await page.evaluate(() => window.sourceDomMotionProof.startStaged())).toBe(true);
	await expect.poll(() => page.evaluate(() => window.sourceDomMotionProof.stagedState().phase)).toBe('held');
	const held = await page.evaluate(() => window.sourceDomMotionProof.stagedState());
	const frames = held.events.filter(event => event.kind === 'frame');
	for (const frame of frames) {
		expect(frame.mutations).toBe(0);
		expect(error(frame.actual!, frame.expected!)).toBeLessThan(0.05);
	}
	const click = held.events.find(event => event.kind === 'click')!;
	const first = frames.find(event => event.progress! > 0.001)!;
	expect(first.time - click.time).toBeLessThan(100);
	expect(held.events.find(event => event.kind === 'hold')!.time).toBeGreaterThan(frames.at(-1)!.time);
	const handoff = held.events.find(event => event.kind === 'held-node')!;
	expect(error(handoff.actual!, handoff.expected!)).toBeLessThan(0.05);
	expect(held.value).toBe('retained across handoff');
	expect(held.events.some(event => event.kind === 'destination-created')).toBe(false);
	await page.evaluate(() => window.sourceDomMotionProof.revealStaged());
	const completed = await page.evaluate(() => window.sourceDomMotionProof.stagedState());
	expect(completed.phase).toBe('complete'); expect(completed.inert).toBe(false);
	expect(completed.events.find(event => event.kind === 'destination-created')!.time).toBeGreaterThan(held.events.find(event => event.kind === 'hold')!.time);
	await expect(page.locator('#incoming')).toHaveCSS('opacity', '1');
});

test('cancelling the moving controller restores its source without handoff or new DOM', async ({ page }) => {
	await page.goto('/tests/fixtures/source-dom-motion/');
	const before = await page.evaluate(() => window.sourceDomMotionProof.state());
	await page.evaluate(() => window.sourceDomMotionProof.startStaged());
	await expect.poll(() => page.evaluate(() => window.sourceDomMotionProof.stagedState().events.filter(event => event.kind === 'frame').length)).toBeGreaterThan(1);
	await page.evaluate(() => window.sourceDomMotionProof.cancelStaged());
	const state = await page.evaluate(() => window.sourceDomMotionProof.stagedState());
	expect(state.phase).toBe('cancelled'); expect(state.mutations).toBe(0); expect(state.inert).toBe(false);
	expect(error(state.corners, before.corners)).toBeLessThan(0.05);
	expect(state.events.some(event => event.kind === 'hold')).toBe(false);
});

test('Reduced Motion retains phase ordering without the normal duration', async ({ page }) => {
	await page.goto('/tests/fixtures/source-dom-motion/');
	await page.evaluate(() => window.sourceDomMotionProof.startStaged(true));
	await expect.poll(() => page.evaluate(() => window.sourceDomMotionProof.stagedState().phase)).toBe('held');
	const state = await page.evaluate(() => window.sourceDomMotionProof.stagedState());
	const click = state.events.find(event => event.kind === 'click')!;
	const end = state.events.find(event => event.kind === 'motion-finished')!;
	expect(end.time - click.time).toBeLessThan(150);
	expect(state.events.find(event => event.kind === 'hold')!.time).toBeGreaterThan(state.events.filter(event => event.kind === 'frame').at(-1)!.time);
	await page.evaluate(() => window.sourceDomMotionProof.revealStaged());
	expect((await page.evaluate(() => window.sourceDomMotionProof.stagedState())).phase).toBe('complete');
});
