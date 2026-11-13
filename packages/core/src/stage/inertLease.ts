/** Independent presentation owners must not capture one another's temporary inert state. */
const leases = new WeakMap<HTMLElement, { original: boolean; owners: Set<object> }>();

export function setInertLease(element: HTMLElement, owner: object, locked: boolean) {
	let state = leases.get(element);
	if (locked) {
		if (!state) {
			state = { original: element.inert, owners: new Set() };
			leases.set(element, state);
		}
		state.owners.add(owner);
		element.inert = true;
	} else if (state?.owners.delete(owner) && state.owners.size === 0) {
		element.inert = state.original;
		leases.delete(element);
	}
}
