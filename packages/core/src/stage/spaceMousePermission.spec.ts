import { describe, expect, it, vi } from 'vitest';
import { observeSpaceMousePermission } from './spaceMousePermission.js';

function permission(state: PermissionState) {
	return Object.assign(new EventTarget(), { state }) as PermissionStatus;
}

describe('SpaceMouse permission observation', () => {
	it('reports existing permission and revocation without requesting access', async () => {
		const status = permission('granted');
		const query = vi.fn().mockResolvedValue(status);
		const change = vi.fn();
		const dispose = observeSpaceMousePermission(change, { query });
		await Promise.resolve();
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
		await Promise.resolve();
		expect(change).toHaveBeenCalledExactlyOnceWith('unknown');
	});
	it('ignores permission results after the stage has unmounted', async () => {
		let resolve!: (status: PermissionStatus) => void;
		const query = vi.fn(() => new Promise<PermissionStatus>(done => { resolve = done; }));
		const change = vi.fn();
		const dispose = observeSpaceMousePermission(change, { query });
		dispose();
		resolve(permission('granted'));
		await Promise.resolve();
		expect(change).not.toHaveBeenCalled();
	});
});
