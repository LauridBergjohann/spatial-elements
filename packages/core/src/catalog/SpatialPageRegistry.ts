import type { SpatialElementData } from '../spatial-element/types.js';

/** @internal A page declares its role, rather than asking its parent layout to inspect route data. */
export type SpatialPage = { kind: 'content'; hdr: string } | { kind: 'detail'; element: SpatialElementData };

/** @internal Each Stage owns an instance; nothing is shared between SSR requests or shells. */
export class SpatialPageRegistry {
	private owner?: symbol;
	constructor(private readonly changed: (read: (() => SpatialPage) | undefined) => void) {}

	register(read: () => SpatialPage) {
		const owner = Symbol();
		this.owner = owner;
		this.changed(read);
		return () => {
			// Kit can mount the destination before destroying the source. Old cleanup must not clear it.
			if (this.owner !== owner) return;
			this.owner = undefined;
			this.changed(undefined);
		};
	}
}
