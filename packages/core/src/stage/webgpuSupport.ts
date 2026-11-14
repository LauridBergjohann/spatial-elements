/** Probe before importing any renderer, shader, geometry or device-driver code. */
export async function hasUsableWebGPU(gpu = globalThis.navigator?.gpu): Promise<boolean> {
	try {
		// Match Three's WebGPU backend: compatibility-only adapters can render our stage too.
		const options: GPURequestAdapterOptions & { featureLevel: 'compatibility' } = {
			featureLevel: 'compatibility'
		};
		return Boolean(await gpu?.requestAdapter(options));
	} catch {
		return false;
	}
}
