export type SpaceMousePermission = PermissionState | 'unknown';

/** Observe permission without contacting the local driver or enumerating devices. */
export function observeSpaceMousePermission(
	onChange: (state: SpaceMousePermission) => void,
	permissions: Pick<Permissions, 'query'> | undefined = globalThis.navigator?.permissions
) {
	let disposed = false;
	let status: PermissionStatus | undefined;
	const notify = () => { if (!disposed && status) onChange(status.state); };
	void (async () => {
		try {
			// Do not substitute `local-network`: LAN permission does not grant loopback access.
			const result = await permissions?.query({ name: 'loopback-network' as PermissionName });
			if (disposed) return;
			status = result;
			if (status) { status.addEventListener('change', notify); notify(); }
			else onChange('unknown');
		} catch {
			// Older browsers cannot answer this query. Only an explicit action may connect.
			if (!disposed) onChange('unknown');
		}
	})();
	return () => { disposed = true; status?.removeEventListener('change', notify); };
}
