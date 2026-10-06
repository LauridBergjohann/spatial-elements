import { getContext, setContext } from 'svelte';
import { resolveSpatialMessages, type SpatialMessagesInput } from '@spatial-elements/core/spatial-element/messages';

const MESSAGES = Symbol('spatial-messages');
export function provideSpatialMessages(read: () => SpatialMessagesInput | undefined) {
	setContext(MESSAGES, read);
}
export function useSpatialMessages() {
	const read = getContext<(() => SpatialMessagesInput | undefined) | undefined>(MESSAGES);
	return () => resolveSpatialMessages(read?.());
}
