import { expect, test, vi } from 'vitest';
import { InteractionGuidance, getInteractionGuidance } from './interactionGuidance.js';

test('one prompt across consumers and remounts, with interaction before hover suppressing it', () => {
	let value: string | null = null;
	const storage = { getItem: () => value, setItem: (_: string, next: string) => { value = next; } };
	const first = new InteractionGuidance(storage);
	expect(first.claimPrompt()).toBe(true);
	expect(first.claimPrompt()).toBe(false);
	const remounted = new InteractionGuidance(storage);
	expect(remounted.claimPrompt()).toBe(false);
	remounted.interact();
	expect(new InteractionGuidance(storage).snapshot.interacted).toBe(true);
	const quickUser = new InteractionGuidance();
	quickUser.interact();
	expect(quickUser.claimPrompt()).toBe(false);
});

test('denied storage keeps an observable in-memory session with safe cleanup', () => {
	const session = new InteractionGuidance({ getItem() { throw Error(); }, setItem() { throw Error(); } });
	const listener = vi.fn();
	const stop = session.subscribe(listener);
	session.interact();
	expect(listener).toHaveBeenLastCalledWith({ prompted: true, interacted: true });
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
