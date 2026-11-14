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
	it('never contacts the local driver when consent is withdrawn during library loading', async () => {
		const signal = new AbortController();
		const construct = vi.fn();
		const adapter = await SpaceMouseAdapter.connect({
			signal: signal.signal, viewport: {} as HTMLElement, applicationName: 'test',
			getViewMatrix: () => [], getFov: () => 1, getViewFrustum: () => [],
			getViewTarget: () => [], getModelExtents: () => [], applyNavigationUpdate: vi.fn()
		}, async () => {
			signal.abort();
			return { default: class { constructor() { construct(); } } as unknown as new (client: NavigationClient) => NavigationConnection };
		});
		expect(construct).not.toHaveBeenCalled();
		adapter.dispose();
	});
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


describe('SpaceMouse connection lifecycle', () => {
 const options = (onStateChange = vi.fn()) => ({ viewport: {} as Window, applicationName: 'test',
  getViewMatrix: () => [], getFov: () => 1, getViewFrustum: () => [], getViewTarget: () => [],
  getModelExtents: () => [], applyNavigationUpdate: vi.fn(), onStateChange });
 function driver() {
  let client!: NavigationClient;
  const close = vi.fn();
  const create = vi.fn();
  return { close, create, get client() { return client; },
   load: async () => ({ default: class implements NavigationConnection {
    constructor(value: NavigationClient) { client = value; }
    connect() { return 1; }
    create3dmouse() { create(); }
    update3dcontroller() { return Promise.resolve(); }
    delete3dmouse() { close(); }
    close() { close(); }
   } }) };
 }
 it('only reports connected after creation, and reports a lost connection', async () => {
  const fake = driver(), state = vi.fn();
  const adapter = await SpaceMouseAdapter.connect(options(state), fake.load);
  expect(state.mock.calls.flat()).toEqual(['connecting']);
  fake.client.onConnect();
  expect(fake.create).toHaveBeenCalledOnce();
  expect(state).not.toHaveBeenCalledWith('connected');
  fake.client.on3dmouseCreated();
  expect(state).toHaveBeenLastCalledWith('connected');
  fake.client.onDisconnect();
  await vi.waitFor(() => expect(state).toHaveBeenLastCalledWith('unavailable'));
  adapter.dispose();
 });
 it('times out an unresponsive driver and closes a late connection without activating it', async () => {
  vi.useFakeTimers();
  try {
   const fake = driver(), state = vi.fn();
   const adapter = await SpaceMouseAdapter.connect(options(state), fake.load);
   await vi.advanceTimersByTimeAsync(12000);
   expect(state).toHaveBeenLastCalledWith('unavailable');
   fake.client.onConnect(); fake.client.on3dmouseCreated();
   expect(fake.create).not.toHaveBeenCalled();
   expect(state).not.toHaveBeenCalledWith('connected');
   expect(fake.close).toHaveBeenCalled();
   adapter.dispose();
  } finally { vi.useRealTimers(); }
 });
 it('cancels pending connections without a failure notification', async () => {
  vi.useFakeTimers();
  try {
   const fake = driver(), state = vi.fn(), abort = new AbortController();
   await SpaceMouseAdapter.connect({ ...options(state), signal: abort.signal }, fake.load);
   abort.abort();
   await vi.advanceTimersByTimeAsync(20000);
   fake.client.on3dmouseCreated();
   expect(state.mock.calls.flat()).toEqual(['connecting']);
  } finally { vi.useRealTimers(); }
 });
 it('distinguishes a browser security rejection from a missing driver', async () => {
  const state = vi.fn();
  const adapter = await SpaceMouseAdapter.connect(options(state), async () => { throw new DOMException('Blocked', 'SecurityError'); });
  await vi.waitFor(() => expect(state).toHaveBeenLastCalledWith('permission-required'));
  adapter.dispose();
 });
});
