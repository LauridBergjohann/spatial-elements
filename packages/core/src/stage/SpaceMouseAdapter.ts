import type { SpaceMouseState } from './spaceMousePlatform.js';

export interface SpaceMouseNavigationUpdate {
	viewMatrix?: number[];
	target?: number[];
	fov?: number;
}

export interface SpaceMouseAdapterOptions {
	/** Cancel a pending library load before it starts accessing the local driver. */
	signal?: AbortSignal;
	/** Window ownership keeps navigation active when focus moves to page content. */
	viewport: HTMLElement | Window;
	applicationName: string;
	getViewMatrix: () => readonly number[];
	getFov: () => number;
	getViewFrustum: () => readonly number[];
	getViewTarget: () => readonly number[];
	getModelExtents: () => readonly number[];
	applyNavigationUpdate: (update: SpaceMouseNavigationUpdate) => void;
	onMotionChange?: (moving: boolean) => void;
	onStateChange?: (state: SpaceMouseState) => void;
}

export interface NavigationClient {
	onConnect: () => void;
	onDisconnect: () => void;
	on3dmouseCreated: () => void;
	onStartMotion: () => void;
	onStopMotion: () => void;
	[key: string]: (() => unknown) | ((value: unknown) => unknown) | undefined;
}

export interface NavigationConnection {
	connect: () => number;
	create3dmouse: (viewport: HTMLElement | Window, applicationName: string) => void;
	update3dcontroller: (update: Record<string, unknown>) => Promise<unknown>;
	delete3dmouse: () => void;
	close: () => void;
}

export type NavigationLibraryLoader = () => Promise<{
	default: new (client: NavigationClient) => NavigationConnection;
}>;

const IDENTITY_AFFINE = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/**
 * Buffers 3DxWare property updates until the enclosing navigation transaction ends.
 * Applying the camera matrix, target, and FOV together avoids rendering partial poses.
 */
export class SpaceMouseUpdateBuffer {
	private transactionOpen = false;
	private pending: SpaceMouseNavigationUpdate = {};

	constructor(private readonly commit: (update: SpaceMouseNavigationUpdate) => void) {}

	setTransaction(value: unknown) {
		this.transactionOpen = Boolean(value);
		if (!this.transactionOpen) this.flush();
	}

	setViewMatrix(value: unknown) {
		if (!isFiniteNumberArray(value, 16)) return;
		this.pending.viewMatrix = [...value];
		this.flushWhenUnbuffered();
	}

	setTarget(value: unknown) {
		if (!isFiniteNumberArray(value, 3)) return;
		this.pending.target = [...value];
		this.flushWhenUnbuffered();
	}

	setFov(value: unknown) {
		if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return;
		this.pending.fov = value;
		this.flushWhenUnbuffered();
	}

	private flushWhenUnbuffered() {
		if (!this.transactionOpen) this.flush();
	}

	private flush() {
		if (!Object.keys(this.pending).length) return;

		const update = this.pending;
		this.pending = {};
		this.commit(update);
	}
}

/**
 * Optional bridge to the official 3Dconnexion Navigation Library.
 *
 * Loading and connecting are deliberately best-effort: a missing 3DxWare driver,
 * blocked localhost connection, or unavailable SpaceMouse never affects ordinary
 * OrbitControls input.
 */
export class SpaceMouseAdapter {
	private connection?: NavigationConnection;
	private created = false;
	private moving = false;
	private disposed = false;
	private timeout?: ReturnType<typeof setTimeout>;
	private readonly abort = () => this.dispose();
	private frameTime = 0;
	private pivotPosition?: number[];
	private readonly updates: SpaceMouseUpdateBuffer;
	private readonly client: NavigationClient;

	private constructor(private readonly options: SpaceMouseAdapterOptions) {
		this.updates = new SpaceMouseUpdateBuffer(update => {
			if (!this.disposed) options.applyNavigationUpdate(update);
		});
		this.client = this.createClient();
		options.signal?.addEventListener('abort', this.abort, { once: true });
	}

	static async connect(
		options: SpaceMouseAdapterOptions,
		loadLibrary: NavigationLibraryLoader = () => import('@3dconnexion/3dconnexionjs')
	) {
		const adapter = new SpaceMouseAdapter(options);
		if (options.signal?.aborted) { adapter.dispose(); return adapter; }
		options.onStateChange?.('connecting');
		adapter.timeout = setTimeout(() => { void adapter.fail(); }, 12000);

		try {
			const module = await loadLibrary();
			if (adapter.disposed || options.signal?.aborted) return adapter;

			adapter.connection = new module.default(adapter.client);
			if (!adapter.connection.connect()) void adapter.fail();
		} catch (error) {
			void adapter.fail(error);
		}

		return adapter;
	}

	updateFrame(time: number) {
		this.frameTime = time;
		if (!this.created || !this.moving) return;

		this.safeControllerUpdate({ frame: { time } });
	}

	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		clearTimeout(this.timeout);
		this.options.signal?.removeEventListener('abort', this.abort);
		this.setMotion(false);

		try {
			if (this.created) this.connection?.delete3dmouse();
			else this.connection?.close();
		} catch {
			// Disposal must not interfere with the renderer teardown.
		}

		this.created = false;
		// Retain the handle so a late SDK onConnect can close a pending local request.
	}

	private async fail(error?: unknown) {
		if (this.disposed) return;
		let permissionRequired = error instanceof Error && ['SecurityError', 'NotAllowedError'].includes(error.name);
		try {
			const permission = await globalThis.navigator?.permissions?.query({ name: 'loopback-network' as PermissionName });
			// An unrequested prompt does not prove a permission failure (the driver may be absent).
			permissionRequired ||= permission?.state === 'denied';
		} catch { /* Unsupported permission descriptor: report connection unavailable. */ }
		if (this.disposed) return;
		this.dispose();
		this.options.onStateChange?.(permissionRequired ? 'permission-required' : 'unavailable');
	}

	private createClient(): NavigationClient {
		return {
			onConnect: () => {
				if (this.disposed) {
					this.connection?.close();
					return;
				}
				try { this.connection?.create3dmouse(this.options.viewport, this.options.applicationName); }
				catch (error) { void this.fail(error); }
			},
			onDisconnect: () => {
				this.created = false;
				this.setMotion(false);
				void this.fail();
			},
			on3dmouseCreated: () => {
				if (this.disposed) { this.connection?.delete3dmouse(); return; }
				this.created = true;
				clearTimeout(this.timeout);
				this.options.onStateChange?.('connected');
				this.safeControllerUpdate({ frame: { timingSource: 1 } });
			},
			onStartMotion: () => {
				this.pivotPosition = undefined;
				this.setMotion(true);
			},
			onStopMotion: () => this.setMotion(false),
			getViewMatrix: this.options.getViewMatrix,
			getConstructionPlane: () => [0, 1, 0, 0],
			getViewExtents: () => [1, 1, 1],
			getFov: this.options.getFov,
			getViewFrustum: this.options.getViewFrustum,
			getPerspective: () => true,
			getViewTarget: this.options.getViewTarget,
			getViewRotatable: () => true,
			getModelExtents: this.options.getModelExtents,
			getFloorPlane: () => [0, 1, 0, 0],
			getUnitsToMeters: () => 1,
			getPivotPosition: () => this.pivotPosition ?? this.options.getViewTarget(),
			getLookAt: () => false,
			getSelectionAffine: this.options.getViewMatrix,
			getSelectionEmpty: () => true,
			getSelectionExtents: this.options.getModelExtents,
			getPointerPosition: () => [0, 0],
			getCoordinateSystem: () => IDENTITY_AFFINE,
			getFrontView: () => IDENTITY_AFFINE,
			getFrameTimingSource: () => 1,
			getFrameTime: () => this.frameTime,
			setMoving: (value) => this.setMotion(Boolean(value)),
			setTransaction: (value) => this.updates.setTransaction(value),
			setViewMatrix: (value) => this.updates.setViewMatrix(value),
			setViewExtents: () => undefined,
			setFov: (value) => this.updates.setFov(value),
			setTarget: (value) => this.updates.setTarget(value),
			setActiveCommand: () => undefined,
			setPivotPosition: (value) => {
				if (isFiniteNumberArray(value, 3)) this.pivotPosition = value.slice(0, 3);
			},
			setPivotVisible: () => undefined,
			setLookFrom: () => undefined,
			setLookDirection: () => undefined,
			setLookAperture: () => undefined,
			setSelectionOnly: () => undefined,
			setSelectionAffine: () => undefined,
			setKeyPress: () => undefined,
			setKeyRelease: () => undefined,
			setSettingsChanged: () => undefined
		};
	}

	private setMotion(moving: boolean) {
		if (moving && this.disposed) return;
		if (this.moving === moving) return;
		this.moving = moving;
		this.options.onMotionChange?.(moving);
	}

	private safeControllerUpdate(update: Record<string, unknown>) {
		try {
			void this.connection?.update3dcontroller(update).catch(() => undefined);
		} catch {
			// Connection loss is isolated from the spatialElement viewer.
		}
	}
}

function isFiniteNumberArray(value: unknown, minimumLength: number): value is number[] {
	return (
		Array.isArray(value) &&
		value.length >= minimumLength &&
		value
			.slice(0, minimumLength)
			.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
	);
}
