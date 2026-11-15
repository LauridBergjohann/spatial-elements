/** Supported desktop OS families, never hardware detection. */
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
	// Android desktop mode can remove every Android/mobile hint and report Linux.
	// Prefer hiding an optional control on ambiguous Linux touch devices.
	if (/Linux/i.test(platform) && (navigator.maxTouchPoints ?? 0) > 0) return false;
	if (/CrOS|Chrome OS|Android|iOS/i.test(platform + ' ' + navigator.userAgent)) return false;
	return /Win|Mac|Linux/i.test(platform);
}

export type SpaceMouseState =
	| 'idle'
	| 'connecting'
	| 'connected'
	| 'permission-required'
	| 'unavailable';
