declare module '@3dconnexion/3dconnexionjs' {
	interface NavigationClient {
		onConnect: () => void;
		[key: string]: unknown;
	}

	interface NavigationConnection {
		connect(): number;
		create3dmouse(viewport: HTMLElement, applicationName: string, options?: number): void;
		update3dcontroller(update: Record<string, unknown>): Promise<unknown>;
		delete3dmouse(): void;
		close(): void;
	}

	export default class ThreeDConnexion {
		constructor(client: NavigationClient);
		connect(): number;
		create3dmouse(viewport: HTMLElement, applicationName: string, options?: number): void;
		update3dcontroller(update: Record<string, unknown>): Promise<unknown>;
		delete3dmouse(): void;
		close(): void;
	}
}
