export type SpaceMousePermission = PermissionState | 'unknown';

type PermissionQuery = Pick<Permissions, 'query'>;
const connectionKey = 'spatial-elements-spacemouse-connected';

/** Query only permissions covering localhost; a LAN-only grant is insufficient. */
export async function querySpaceMousePermission(
	permissions: PermissionQuery | undefined = globalThis.navigator?.permissions
): Promise<PermissionStatus | undefined> {
	if (!permissions) return;
	for (const name of ['loopback-network', 'local-network-access']) {
		try {
			return await permissions.query({ name: name as PermissionName });
		} catch {
			// Some browsers expose only the older combined permission, or neither name.
		}
	}
}

/** Store successful use, never a guessed browser permission or device identifier. */
export function rememberSpaceMouseConnection() {
	try { globalThis.localStorage?.setItem(connectionKey, 'true'); } catch { /* Storage may be blocked. */ }
}

export function shouldReconnectSpaceMouse(permission: SpaceMousePermission): boolean {
	if (permission === 'granted') return true;
	if (permission !== 'unknown') return false;
	try { return globalThis.localStorage?.getItem(connectionKey) === 'true'; } catch { return false; }
}

/** Observe permission without contacting the local driver or enumerating devices. */
export function observeSpaceMousePermission(
	onChange: (state: SpaceMousePermission) => void,
	permissions: PermissionQuery | undefined = globalThis.navigator?.permissions
) {
	let disposed = false;
	let status: PermissionStatus | undefined;
	const notify = () => { if (!disposed && status) onChange(status.state); };
	void (async () => {
		try {
			const result = await querySpaceMousePermission(permissions);
			if (disposed) return;
			status = result;
			if (status) { status.addEventListener('change', notify); notify(); }
			else onChange('unknown');
		} catch {
			// An unreadable permission can use a previously successful connection as a hint.
			if (!disposed) onChange('unknown');
		}
	})();
	return () => { disposed = true; status?.removeEventListener('change', notify); };
}
