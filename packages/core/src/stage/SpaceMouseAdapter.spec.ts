import { describe, expect, it, vi } from 'vitest';
import {
	SpaceMouseAdapter,
	SpaceMouseUpdateBuffer,
	type NavigationClient,
	type NavigationConnection
} from './SpaceMouseAdapter.js';

describe('SpaceMouseUpdateBuffer', () => {
	it('commits matrix, target, and FOV atomically at the end of a transaction', () => {
		const commit = vi.fn();
		const updates = new SpaceMouseUpdateBuffer(commit);
		const matrix = Array.from({ length: 16 }, (_, index) => index);

		updates.setTransaction(1);
		updates.setViewMatrix(matrix);
		updates.setTarget([1, 2, 3]);
		updates.setFov(Math.PI / 4);
		expect(commit).not.toHaveBeenCalled();

		updates.setTransaction(0);
		expect(commit).toHaveBeenCalledOnce();
		expect(commit).toHaveBeenCalledWith({
			viewMatrix: matrix,
			target: [1, 2, 3],
			fov: Math.PI / 4
		});
	});

	it('commits standalone updates immediately and ignores malformed payloads', () => {
		const commit = vi.fn();
		const updates = new SpaceMouseUpdateBuffer(commit);

		updates.setTarget([4, 5, 6]);
		updates.setTarget([1, Number.NaN, 3]);
		updates.setFov(-1);

		expect(commit).toHaveBeenCalledOnce();
		expect(commit).toHaveBeenCalledWith({ target: [4, 5, 6] });
	});
});

describe('SpaceMouseAdapter', () => {
	it('keeps the navigation pivot separate from the OrbitControls view target', async () => {
		let client: NavigationClient | undefined;
		const applyNavigationUpdate = vi.fn();

		class FakeConnection implements NavigationConnection {
			constructor(navigationClient: NavigationClient) {
				client = navigationClient;
			}

			connect() {
				return 1;
			}

			create3dmouse() {}
			update3dcontroller() {
				return Promise.resolve();
			}

			delete3dmouse() {}
			close() {}
		}

		const adapter = await SpaceMouseAdapter.connect(
			{
				viewport: {} as HTMLElement,
				applicationName: 'test',
				getViewMatrix: () => [],
				getFov: () => Math.PI / 4,
				getViewFrustum: () => [],
				getViewTarget: () => [0, 0, 0],
				getModelExtents: () => [],
				applyNavigationUpdate
			},
			async () => ({ default: FakeConnection })
		);

		if (!client) throw new Error('The fake navigation client was not created');
		const navigationClient = client as NavigationClient;
		(navigationClient.setTransaction as (value: unknown) => void)(1);
		(navigationClient.setTarget as (value: unknown) => void)([1, 2, 3]);
		(navigationClient.setPivotPosition as (value: unknown) => void)([9, 8, 7]);
		(navigationClient.setTransaction as (value: unknown) => void)(0);

		expect(applyNavigationUpdate).toHaveBeenCalledOnce();
		expect(applyNavigationUpdate).toHaveBeenCalledWith({ target: [1, 2, 3] });
		expect((navigationClient.getPivotPosition as () => number[])()).toEqual([9, 8, 7]);

		adapter.dispose();
	});
});
