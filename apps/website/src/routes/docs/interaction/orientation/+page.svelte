<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Device orientation' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Device orientation',
			headingLevel: 1,
			headingSize: 'm',
			background: { color: 'standard', size: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'introduction',
			title: 'Introduction',
			headline: 'Introduction',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				<code>SpatialCardGridSection</code> and <code>SpatialCarouselSection</code> enable device
				orientation automatically; neither component exposes a <code>deviceOrientation</code>
				option. Enable <code>deviceOrientation</code> on <code>BrandStageShell</code> (or
				<code>Stage</code>) for detail geometry and minimaps. List/detail panels, text, and fallback
				posters are unaffected. Added yaw is bounded to ±16 degrees and pitch (forward/backward
				tilt) to ±10 degrees. Roll is limited to ±6 degrees. All three axes counter-rotate: the
				geometry feels stationary as the viewer moves.
			</p>
			<p>
				The effect runs on secure origins with DeviceOrientationEvent, including devices advertising
				a fine pointer (e.g. tablets with a mouse). Access starts automatically where allowed,
				otherwise permission is requested on internal navigation. A denied permission, missing
				sensor, or reduced-motion preference leaves the list usable without the effect. API
				availability cannot guarantee that hardware will actually deliver events. No absolute
				compass/north reference is required.
			</p>
			<p>
				W3C Z-X-Y orientation is converted to a quaternion and corrected for screen orientation.
				Relative twist about screen-up drives model Y rotation; twist about screen-right drives X
				rotation; screen-normal twist drives Z rotation. These filtered angles are inverted in the
				rendering layer. This maps portrait and landscape without device/vendor-specific alpha/gamma
				shortcuts. The initial grip and screen-orientation changes establish a neutral reference.
			</p>
			<ul>
				<li>
					The first valid sample establishes neutral immediately; later deliberate motion is not
					absorbed by a startup calibration window.
				</li>
				<li>Dead zones are 1.2 degrees for yaw and 1.5 degrees for pitch.</li>
				<li>Roll uses a 2 degree dead zone and gain 0.25, capped at 6 degrees.</li>
				<li>
					Screen orientation changes reset all axes immediately, ignore intermediate readings for
					300 ms, then use the next valid sample as the new neutral pose. Both modern/legacy screen
					events and angle changes in sensor samples are handled.
				</li>
				<li>Sensor processing is limited to approximately 60 Hz, with a 60 ms low-pass filter.</li>
				<li>Yaw gain is 0.55, capped at 16 degrees; pitch gain is 0.4, capped at 10 degrees.</li>
				<li>Output hysteresis is 0.12 degrees; unchanged values never invalidate rendering.</li>
				<li>
					Abrupt motion above 240 degrees/second AND 12 degrees per processed sample re-anchors and
					waits 400 ms for a quiet grip. Ordinary turns are not suppressed.
				</li>
				<li>
					Gaps over 1500 ms and invalid tilt readings reset calibration. A missing alpha does not
					discard usable beta/gamma; changes in heading availability recalibrate.
				</li>
				<li>
					Visible geometry settles using the existing on-demand rendering loop with a 25 ms time
					constant (previously about 71 ms, on top of a 180 ms sensor filter).
				</li>
				<li>
					All sensor-enabled sections share one listener. Offscreen lists, hidden documents, reduced
					motion, and unmounting suspend or release it. Mouse hover and sensor rotation can coexist;
					a stationary cursor must not disable the sensor.
				</li>
			</ul>
			<p>
				These are experimental tuning values, not a guarantee of identical sensor quality across
				devices. The axis mapping and filtering have deterministic tests; physical device testing
				remains necessary.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'hardware-acceptance-pass',
			title: 'Hardware acceptance pass',
			headline: 'Hardware acceptance pass',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Serve over HTTPS (a phone's LAN HTTP address is not a secure origin). Check iOS Safari,
				Android Chrome and a sensor-equipped Windows tablet, both portrait and landscape, including
				natural-landscape hardware:
			</p>
			<ol>
				<li>Load a list at an arbitrary grip: no initial jump or movement from small scrolls.</li>
				<li>
					Slowly turn left/right, tilt forward/backward and roll: geometry counter-rotates up to
					±16° yaw, ±10° pitch and ±6° roll.
				</li>
				<li>Hold still: geometry settles and rendering becomes idle despite sensor noise.</li>
				<li>Cross north/360°, rotate the screen, background/resume, then repeat.</li>
				<li>Walk, turn rapidly and stop: the effect quiets and recalibrates without flips.</li>
				<li>
					Deny the navigation-triggered permission prompt and enable reduced motion: normal
					navigation still works.
				</li>
				<li>
					Scroll list/carousel sections offscreen: no sensor-driven frames. On detail pages, verify
					both main geometry and minimap react; on carousels, verify the shared camera moves.
				</li>
				<li>On hybrid tablets, use a mouse and then touch; verify mouse hover still works.</li>
			</ol>
			<p>
				The browser regression test <code>device-orientation.e2e.ts</code> injects orientation events
				on a fine-pointer desktop after mouse movement, checks inverted rendered angles and a visible
				image change, then verifies roll, screen recalibration and reduced motion. This does not replace
				testing real sensor timing and calibration on hardware.
			</p>
			<p>Reference: https://www.w3.org/TR/orientation-event/</p>
		</div></Section
	>
	<Section
		section={{
			id: 'automatic-access',
			title: 'Automatic access',
			headline: 'Automatic access',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Lists and carousels acquire sensor access automatically. Enable <code
					>deviceOrientation</code
				>
				on BrandStageShell for detail geometry and minimaps as well. The shell silently attempts to reuse
				existing permission. If user activation is required, it requests permission synchronously on a
				trusted, unmodified internal link click. It does not prevent or delay client-side navigation.
				External links, downloads and new-tab clicks are excluded. There is no activation button. Granted/denied
				results are shared across routes for this document lifetime; a denial is not retried. Reduced
				motion suppresses requests. Actual browser prompts remain browser-controlled. Full-document navigation
				may interrupt a pending prompt; client-side routing retains the request and its result.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'scroll-and-viewport-changes',
			title: 'Scroll and viewport changes',
			headline: 'Scroll and viewport changes',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Native/virtual scrolling and touch contact pause sensor evaluation and application. This
				includes horizontal carousel drags, held fingers and multi-touch. Pointer cancellation
				during native scrolling does not resume the effect while a touch remains. Samples stay
				paused until every finger has lifted and scrolling has been quiet for 160 ms (including
				momentum). The first valid sample then establishes a new neutral grip. Existing output is
				preserved and gently eased toward the new reference with a 400 ms filter for the first 700
				ms; it never resets in one frame. The shared policy applies to lists, detail
				geometry/minimap and carousels. Detail geometry rotates around its original center in camera
				coordinates. The minimap applies the same motion once, including its rest and docked views.
				Authored orientations and camera controls remain the base for these rotations.
			</p>
			<p>
				Canvas CSS dimensions now match the renderer's pixel dimensions and camera viewport instead
				of using a separately changing <code>100vh</code> height. Resize events are coalesced into the
				next render frame, which updates targets and projection together. Visual viewport changes also
				invalidate rendering. Browser regressions cover main/minimap motion, scroll suspension and canvas
				aspect ratios across height changes. Actual Android address-bar animation and physical-device
				scroll performance still require a hardware acceptance pass.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'carousel-camera',
			title: 'Carousel camera',
			headline: 'Carousel camera',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				<code>SpatialCarouselSection</code> automatically uses the same permission, calibration, scroll
				suspension and sensor filtering as lists/details. The geometry camera orbits the selected model
				centre, preserving its screen position even in an off-centre desktop layout. All seats share this
				perspective: carousel seat positions and selection remain unchanged. Background models gain real
				3D parallax. Geometry, shadows, blur and geometry hit regions use the orbit camera; DOM panels
				and their glass use a fixed UI camera, keeping panels, arrows and selection dots stationary. Camera
				motion is frozen during catalog capture/handoff.
			</p>
			<p>
				The sensor uses one quarter of the filtered card angles, capped at 4 degrees yaw, 2.5
				degrees pitch and 1.5 degrees roll. This reduces background distraction without changing
				mouse strength or the shared sensor filter. Reduced motion resets the camera immediately.
				The shared camera affects all carousels on a page; all carousel sections participate
				automatically. The brand examples enable this for watches, Wera and Wurm, including mixed
				pages. The selected model receives an additional counter-rotation at 75% of the shared
				sensor angles (up to 12 degrees yaw, 7.5 pitch and 4.5 roll). Together with the unchanged
				25% camera orbit, this gives the focus model approximately card strength while retaining the
				quiet background. Extra model rotation eases out when selection changes; reduced motion
				clears it. Sensor scroll suspension still applies.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'mouse-proximity',
			title: 'Mouse proximity',
			headline: 'Mouse proximity',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Mouse movement no longer changes the carousel camera. Each visible model leans toward a
				nearby mouse independently, using the original 4 degree bound, 150 px smooth falloff outside
				its projected bounds and 12/s damping. While dragging, mouse tilt eases to neutral. Touch
				and pen input do not activate mouse tilt. Panels, navigation UI and the background camera
				are unaffected by mouse movement. The focus model can combine this local mouse tilt with its
				independent sensor rotation. Shadows and hit regions follow the geometry.
			</p>
		</div></Section
	>
</WebsitePage>
