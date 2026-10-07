export interface ButtonGroupItem {
	value: string;
	/** Accessible name and default tooltip. */
	label: string;
	tooltip?: string;
	disabled?: boolean;
	/** Visual selection strength (0–1), independent of aria-pressed. */
	selection?: number;
}
