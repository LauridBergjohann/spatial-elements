import { describe, expect, it, vi } from 'vitest';
import { isSpaceMouseDesktop } from './spaceMousePlatform.js';
import { hasUsableWebGPU } from './webgpuSupport.js';

describe('SpaceMouse platform eligibility', () => {
	it.each(['Win32', 'MacIntel', 'Linux x86_64'])('offers desktop controls on %s', (platform) => {
		expect(
			isSpaceMouseDesktop({
				platform,
				userAgent: 'Mozilla/5.0',
				maxTouchPoints: platform === 'Win32' ? 10 : 0
			})
		).toBe(true);
	});
	it.each([
		{ platform: 'Linux armv8l', userAgent: 'Mozilla/5.0 Android' },
		{ platform: 'iPhone', userAgent: 'Mozilla/5.0 iPhone' },
		{ platform: 'MacIntel', userAgent: 'Mozilla/5.0 Macintosh', maxTouchPoints: 5 },
		{ userAgent: 'Mozilla/5.0', userAgentData: { platform: 'Linux', mobile: true } }
	])('does not mistake mobile devices for desktops: %j', (navigator) => {
		expect(isSpaceMouseDesktop(navigator)).toBe(false);
	});
	it('does not infer desktop hardware during server rendering', () =>
		expect(isSpaceMouseDesktop()).toBe(false));
});

describe('WebGPU preflight', () => {
	it('rejects absent, refused and unavailable adapters without loading the renderer', async () => {
		expect(await hasUsableWebGPU(undefined)).toBe(false);
		expect(
			await hasUsableWebGPU({ requestAdapter: vi.fn().mockResolvedValue(null) } as unknown as GPU)
		).toBe(false);
		expect(
			await hasUsableWebGPU({
				requestAdapter: vi.fn().mockRejectedValue(new Error('disabled'))
			} as unknown as GPU)
		).toBe(false);
	});
	it('accepts a real adapter', async () => {
		expect(
			await hasUsableWebGPU({ requestAdapter: vi.fn().mockResolvedValue({}) } as unknown as GPU)
		).toBe(true);
	});
	it('also accepts adapters that expose only the renderer compatibility feature level', async () => {
		const gpu = {
			requestAdapter: async (options: { featureLevel?: string }) =>
				options.featureLevel === 'compatibility' ? {} : null
		};
		expect(await hasUsableWebGPU(gpu as unknown as GPU)).toBe(true);
	});
});
