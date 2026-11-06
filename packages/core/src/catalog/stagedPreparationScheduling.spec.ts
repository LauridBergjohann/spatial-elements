import { afterEach, expect, test, vi } from 'vitest';
import { StageExperience } from '../stage/StageExperience.js';

afterEach(() => vi.unstubAllGlobals());

function fixture() {
	const idle: (() => void)[] = [];
	vi.stubGlobal('window', { requestIdleCallback: (callback: () => void) => idle.push(callback) });
	let finish!: () => void;
	const pending = new Promise<void>(resolve => { finish = resolve; });
	let needsPreparation = true;
	const layer = {
		needsStagedPreparation: () => needsPreparation,
		prepareStagedNavigation: vi.fn(() => { needsPreparation = false; return pending; })
	};
	const stage = Object.assign(Object.create(StageExperience.prototype), {
		stagedPreparationIdle: 0, stagedPreparationAbort: new AbortController(),
		pipeline: { backgroundOutputHeld: false, ensureCatalogWarmOutputContext: vi.fn(() => undefined) },
		catalogPresentation: { active: false }, catalogLayer: layer,
		preparationGate: { run: (work: () => unknown) => Promise.resolve(work()) }
	}) as { scheduleStagedPreparation(): void; scrollActive: boolean; disposed: boolean };
	return { stage, layer, idle, finish, addReadyActor: () => { needsPreparation = true; } };
}

test('an actor rendered during pending GPU preparation gets its own idle follow-up without new input', async () => {
	const f = fixture();
	f.stage.scheduleStagedPreparation();
	expect(f.idle).toHaveLength(1);
	f.idle.shift()!();
	expect(f.layer.prepareStagedNavigation).toHaveBeenCalledTimes(1);
	f.addReadyActor();
	f.finish();
	await vi.waitFor(() => expect(f.idle).toHaveLength(1));
	f.idle.shift()!();
	await vi.waitFor(() => expect(f.layer.prepareStagedNavigation).toHaveBeenCalledTimes(2));
	await Promise.resolve();
	expect(f.idle).toHaveLength(0);
});

test.each(['scrollActive', 'disposed'] as const)('a %s stage does not schedule more preparation after pending GPU work', async property => {
	const f = fixture();
	f.stage.scheduleStagedPreparation(); f.idle.shift()!();
	f.addReadyActor(); f.stage[property] = true; f.finish();
	await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
	expect(f.idle).toHaveLength(0);
	expect(f.layer.prepareStagedNavigation).toHaveBeenCalledTimes(1);
});
