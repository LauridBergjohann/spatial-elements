import type { LayoutLoad } from './$types';
import { slotFromPath } from '$lib/persistence-proof/handoff';

// Request-local SSR descriptor: the parent can render the real instance before child mount.
export const load: LayoutLoad = ({ url }) => ({ initialSlot: slotFromPath(url.pathname) ?? 'source', holdMotion: url.searchParams.has('hold') });
