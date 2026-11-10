<script lang="ts">
	import { onMount } from 'svelte';
	let body: HTMLElement;
	let enhanced = $state(false);
	let zoom = $state(false);
	let extra = $state(false);
	let savedScroll = 0;
	const chapters = Array.from({ length: 9 }, (_, index) => index + 1);

	onMount(() => {
		let height = body.offsetHeight;
		let frame = 0;
		const update = () => {
			frame = 0;
			body.style.setProperty('--clip-top', `${Math.max(0, window.scrollY + 182)}px`);
			body.style.setProperty(
				'--clip-bottom',
				`${Math.max(0, height - window.scrollY - window.innerHeight + 60)}px`
			);
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		const observer = new ResizeObserver(() => {
			height = body.offsetHeight;
			schedule();
		});
		observer.observe(body);
		window.addEventListener('scroll', schedule, { passive: true });
		window.addEventListener('resize', schedule, { passive: true });
		const focus = (event: FocusEvent) => {
			if (!(event.target instanceof HTMLElement) || !body.contains(event.target)) return;
			const rect = event.target.getBoundingClientRect();
			if (rect.top < 182 || rect.bottom > window.innerHeight - 60) {
				window.scrollBy({ top: rect.top - 194, behavior: 'instant' });
			}
		};
		body.addEventListener('focusin', focus);
		update();
		enhanced = true;
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			window.removeEventListener('scroll', schedule);
			window.removeEventListener('resize', schedule);
			body.removeEventListener('focusin', focus);
		};
	});
	function toggleZoom() {
		if (!zoom) savedScroll = window.scrollY;
		zoom = !zoom;
		if (!zoom)
			requestAnimationFrame(() => window.scrollTo({ top: savedScroll, behavior: 'instant' }));
	}
</script>

<svelte:head><title>Ultra-wide document scroll proof</title></svelte:head>

<div class="proof" class:zoom data-scroll-proof data-enhanced={enhanced}>
	<div class="stage" aria-label="Fixed media area">
		<strong>Fixed media</strong>
		<p>The entire document remains the scroll owner.</p>
	</div>
	<nav class="menu" aria-label="Proof actions">
		<a href="/proof/ultrawide">Top</a><button onclick={toggleZoom} aria-pressed={zoom}
			>{zoom ? 'Return to content' : 'Zoom'}</button
		>
	</nav>
	<div class="surface" aria-hidden="true"></div>
	<div class="top-cover" aria-hidden="true"></div>
	<header class="pane-header" inert={zoom}>
		<p>Layout proof / document scrolling</p>
		<h1>Native anchors and retained reading position</h1>
	</header>
	<main bind:this={body} class:clipped={enhanced} inert={zoom} data-pane-body>
		<section id="summary">
			<h2>Summary</h2>
			<p>
				This is ordinary document content with a reserved header and bottom area. The enhanced clip
				only affects painting and hit testing.
			</p>
			<label>Retained value <input value="Original value" /></label><button
				onclick={() => (extra = !extra)}>Toggle late content</button
			>{#if extra}<p class="late">Late content adds height in normal document flow.</p>{/if}
		</section>
		{#each chapters as chapter}
			<section id={`chapter-${chapter}`}>
				<h2>Chapter {chapter}</h2>
				<p>
					Unique searchable passage {chapter}. Native fragment links, focus and browser history keep
					their document coordinates.
				</p>
				<label>Chapter {chapter} note <input name={`note-${chapter}`} /></label>
				<a href={`#chapter-${chapter === 9 ? 1 : chapter + 1}`}>Next chapter</a>
			</section>
		{/each}
		<p data-last-line>End of content remains reachable.</p>
	</main>
	<div class="bottom-cover" aria-hidden="true"></div>
	<nav class="submenu" aria-label="Chapters" inert={zoom}>
		<a href="#summary">Overview</a>{#each chapters as chapter}<a href={`#chapter-${chapter}`}
				>{chapter}</a
			>{/each}
	</nav>
</div>

<style>
	:global(html) {
		scroll-padding-top: 182px;
		scroll-padding-bottom: 60px;
		scroll-behavior: auto;
	}
	:global(body) {
		margin: 0;
		background: #e9eef5;
		color: #192536;
		font:
			16px/1.5 system-ui,
			sans-serif;
	}
	.proof {
		--pane-left: calc(50% + 8px);
		--pane-width: min(calc(50% - 28px), 1536px);
	}
	.stage {
		position: fixed;
		left: 178px;
		right: calc(50% + 8px);
		top: 96px;
		bottom: 16px;
		display: grid;
		place-content: center;
		background: #c6d9ef;
		border-radius: 16px;
	}
	.menu {
		position: fixed;
		z-index: 5;
		top: 16px;
		left: max(136px, calc((100% - 1536px) / 2));
		right: max(136px, calc((100% - 1536px) / 2));
		height: 64px;
		background: #fff;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 24px;
		box-sizing: border-box;
		border-radius: 16px;
	}
	.surface {
		position: fixed;
		z-index: -1;
		top: 96px;
		bottom: 60px;
		left: var(--pane-left);
		width: var(--pane-width);
		background: #fff;
		border-radius: 16px;
	}
	main {
		position: relative;
		box-sizing: border-box;
		margin-left: var(--pane-left);
		width: var(--pane-width);
		padding-top: 182px;
		padding-bottom: 60px;
	}
	main.clipped {
		clip-path: inset(var(--clip-top) 0 var(--clip-bottom));
	}
	section {
		padding: 24px;
		min-height: 440px;
		box-sizing: border-box;
		background: #fff;
	}
	section:nth-child(even) {
		background: #f6f8fb;
	}
	section h2 {
		margin: 0 0 16px;
	}
	section:target h2 {
		text-decoration: underline;
	}
	label {
		display: block;
		margin-bottom: 20px;
	}
	input,
	button,
	a {
		font: inherit;
	}
	input {
		padding: 8px;
	}
	button {
		padding: 8px 16px;
	}
	a {
		color: #174d96;
	}
	.late {
		height: 300px;
		background: #c6d9ef;
	}
	[data-last-line] {
		margin: 0;
		padding: 24px;
		background: #fff;
	}
	.pane-header {
		position: fixed;
		z-index: 3;
		top: 96px;
		height: 86px;
		left: var(--pane-left);
		width: var(--pane-width);
		padding: 8px 24px;
		box-sizing: border-box;
		background: #fff;
		border-radius: 16px 16px 0 0;
	}
	.pane-header p {
		margin: 0;
		font-size: 14px;
	}
	.pane-header h1 {
		margin: 0;
		font-size: 24px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.top-cover,
	.bottom-cover {
		position: fixed;
		z-index: 2;
		left: var(--pane-left);
		width: var(--pane-width);
		background: #e9eef5;
	}
	.top-cover {
		top: 0;
		height: 96px;
	}
	.bottom-cover {
		bottom: 0;
		height: 60px;
	}
	.submenu {
		position: fixed;
		z-index: 3;
		top: calc(100vh - 60px);
		left: calc(var(--pane-left) + var(--pane-width) / 2);
		transform: translateX(-50%);
		height: 44px;
		max-width: var(--pane-width);
		display: flex;
		gap: 20px;
		align-items: center;
		padding: 0 20px;
		box-sizing: border-box;
		background: #fff;
		border-radius: 12px;
	}
	.zoom main,
	.zoom .surface,
	.zoom .pane-header,
	.zoom .submenu,
	.zoom .top-cover,
	.zoom .bottom-cover {
		visibility: hidden;
	}
	.zoom .stage {
		right: 16px;
	}
	@media (max-height: 511px) {
		.stage,
		.surface,
		.top-cover,
		.bottom-cover {
			display: none;
		}
		.menu {
			position: relative;
			inset: auto;
			width: 100%;
		}
		.pane-header {
			position: relative;
			inset: auto;
			width: min(100%, 1536px);
			margin: auto;
		}
		main,
		main.clipped {
			width: min(100%, 1536px);
			margin: auto;
			padding: 0;
			clip-path: none;
		}
		.submenu {
			display: none;
		}
		:global(html) {
			scroll-padding: 0;
		}
	}
</style>
