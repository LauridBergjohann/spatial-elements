import { expect, test, vi } from 'vitest';
import { InteractionGuidance, getInteractionGuidance } from './interactionGuidance.js';

test('only actual interaction persists, including sessions saved by the older one-prompt behavior', () => {
	let value: string | null = JSON.stringify({ prompted: true, interacted: false });
	const storage = { getItem: () => value, setItem: (_: string, next: string) => { value = next; } };
	const first = new InteractionGuidance(storage);
	expect(first.snapshot.interacted).toBe(false);
	const remounted = new InteractionGuidance(storage);
	expect(remounted.snapshot.interacted).toBe(false);
	remounted.interact();
	expect(new InteractionGuidance(storage).snapshot.interacted).toBe(true);
	const quickUser = new InteractionGuidance();
	quickUser.interact();
	expect(quickUser.snapshot.interacted).toBe(true);
});

test('denied storage keeps an observable in-memory session with safe cleanup', () => {
	const session = new InteractionGuidance({ getItem() { throw Error(); }, setItem() { throw Error(); } });
	const listener = vi.fn();
	const stop = session.subscribe(listener);
	session.interact();
	expect(listener).toHaveBeenLastCalledWith({ interacted: true });
	stop();
	session.interact();
	expect(listener).toHaveBeenCalledTimes(2);
});

test('browser sessions share state while separate windows and server callers remain isolated', () => {
	const first = {} as Window, second = {} as Window;
	getInteractionGuidance(first).interact();
	expect(getInteractionGuidance(first).snapshot.interacted).toBe(true);
	expect(getInteractionGuidance(second).snapshot.interacted).toBe(false);
	expect(getInteractionGuidance().snapshot.interacted).toBe(false);
});
