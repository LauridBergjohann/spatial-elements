/** A platform hint, never hardware detection. Touch-capable desktops remain eligible. */
export function isSpaceMouseDesktop(navigator?: {
	userAgent: string;
	platform?: string;
	maxTouchPoints?: number;
	userAgentData?: { platform: string; mobile?: boolean };
}): boolean {
	if (!navigator) return false;
	if (navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
		return false;
	const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent;
	// iPadOS can present a desktop Mac user agent.
	if (/Mac/i.test(platform) && (navigator.maxTouchPoints ?? 0) > 1) return false;
	return /Win|Mac|Linux/i.test(platform);
}

export type SpaceMouseState =
	| 'idle'
	| 'connecting'
	| 'connected'
	| 'permission-required'
	| 'unavailable';
