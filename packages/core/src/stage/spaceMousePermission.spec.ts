import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeSpaceMousePermission, querySpaceMousePermission, rememberSpaceMouseConnection, shouldReconnectSpaceMouse } from './spaceMousePermission.js';

afterEach(() => vi.unstubAllGlobals());

function permission(state: PermissionState) {
	return Object.assign(new EventTarget(), { state }) as PermissionStatus;
}

describe('SpaceMouse permission observation', () => {
	it('reports existing permission and revocation without requesting access', async () => {
		const status = permission('granted');
		const query = vi.fn().mockResolvedValue(status);
		const change = vi.fn();
		const dispose = observeSpaceMousePermission(change, { query });
		await vi.waitFor(() => expect(change).toHaveBeenCalled());
		expect(query).toHaveBeenCalledExactlyOnceWith({ name: 'loopback-network' });
		expect(change).toHaveBeenLastCalledWith('granted');
		Object.assign(status, { state: 'denied' });
		status.dispatchEvent(new Event('change'));
		expect(change).toHaveBeenLastCalledWith('denied');
		dispose();
		status.dispatchEvent(new Event('change'));
		expect(change).toHaveBeenCalledTimes(2);
	});
	it('treats an unsupported permission as unknown rather than probing the driver', async () => {
		const change = vi.fn();
		observeSpaceMousePermission(change, { query: vi.fn().mockRejectedValue(new TypeError()) });
		await vi.waitFor(() => expect(change).toHaveBeenCalled());
		expect(change).toHaveBeenCalledExactlyOnceWith('unknown');
	});
	it('ignores permission results after the stage has unmounted', async () => {
		let resolve!: (status: PermissionStatus) => void;
		const query = vi.fn(() => new Promise<PermissionStatus>(done => { resolve = done; }));
		const change = vi.fn();
		const dispose = observeSpaceMousePermission(change, { query });
		dispose();
		resolve(permission('granted'));
		await query.mock.results[0].value;
		await Promise.resolve();
		expect(change).not.toHaveBeenCalled();
	});
	it('observes the legacy combined permission when loopback permission is unsupported', async () => {
		const status = permission('granted');
		const query = vi.fn().mockRejectedValueOnce(new TypeError()).mockResolvedValue(status);
		const change = vi.fn();
		const dispose = observeSpaceMousePermission(change, { query });
		await vi.waitFor(() => expect(change).toHaveBeenCalledWith('granted'));
		expect(query.mock.calls.map(([descriptor]) => descriptor.name)).toEqual(['loopback-network', 'local-network-access']);
		Object.assign(status, { state: 'denied' });
		status.dispatchEvent(new Event('change'));
		expect(change).toHaveBeenLastCalledWith('denied');
		dispose();
		status.dispatchEvent(new Event('change'));
		expect(change).toHaveBeenCalledTimes(2);
	});
	it.each(['prompt', 'denied'] as const)('never substitutes a broader permission for an explicit %s', async (state) => {
		const query = vi.fn().mockResolvedValue(permission(state));
		expect((await querySpaceMousePermission({ query }))?.state).toBe(state);
		expect(query).toHaveBeenCalledExactlyOnceWith({ name: 'loopback-network' });
	});
});

describe('SpaceMouse reconnection preference', () => {
	it('reconnects after successful use even if the permission remains prompt or unknown', () => {
		const values = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value)
		});
		expect(shouldReconnectSpaceMouse('unknown')).toBe(false);
		expect(shouldReconnectSpaceMouse('prompt')).toBe(false);
		expect(shouldReconnectSpaceMouse('granted')).toBe(true);
		rememberSpaceMouseConnection();
		expect(shouldReconnectSpaceMouse('unknown')).toBe(true);
		expect(shouldReconnectSpaceMouse('prompt')).toBe(true);
		expect(shouldReconnectSpaceMouse('denied')).toBe(false);
		values.clear();
		expect(shouldReconnectSpaceMouse('unknown')).toBe(false);
		expect(shouldReconnectSpaceMouse('prompt')).toBe(false);
	});
	it('keeps manual connections usable when storage is blocked', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => { throw new Error('Storage blocked'); },
			setItem: () => { throw new Error('Storage blocked'); }
		});
		expect(() => rememberSpaceMouseConnection()).not.toThrow();
		expect(shouldReconnectSpaceMouse('unknown')).toBe(false);
		expect(shouldReconnectSpaceMouse('granted')).toBe(true);
	});
});
