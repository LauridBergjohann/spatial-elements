<script lang="ts">
	import { afterNavigate, beforeNavigate, goto, onNavigate, preloadData } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { onDestroy, onMount, untrack } from 'svelte';
	import type { NavigationBase } from '@sveltejs/kit';
	import type { LayoutProps } from './$types';
	import { proofState, trace } from '$lib/staged-navigation-proof/telemetry';

	let { children }: LayoutProps = $props();
	const strategy = untrack(() =>
		page.url.searchParams.get('strategy') === 'gate' ? 'gate' : 'deferred'
	);
	const motionDuration = untrack(() =>
		Math.min(1500, Math.max(100, Number(page.url.searchParams.get('motion')) || 500))
	);
	const ticket = untrack(() => page.url.searchParams.get('ticket') ?? 'default');
	let phase = $state('idle');
	let ready = $state(false);
	let warmed = $state(false);
	let actor: HTMLDivElement;
	let generation = 0;
	interface Owner {
		id: number;
		href: string;
		complete: Promise<void>;
		motion: Promise<boolean>;
		release: (completed: boolean) => void;
		animation?: Animation;
		frame: number;
		ended: boolean;
		cancelled: boolean;
		committing: boolean;
	}
	let current: Owner | undefined;
	let permit: { owner: number; href: string } | undefined;
	const gateOwners = new Map<Promise<void>, Owner>();
	const belongs = (url?: URL | null) =>
		url?.pathname.startsWith('/proof/staged-navigation/') ?? false;

	function href(slug: string, delay = 0) {
		return `/proof/staged-navigation/${slug}?${new URLSearchParams({ strategy, motion: String(motionDuration), ticket, delay: String(delay) })}`;
	}
	function setPhase(next: string) {
		phase = next;
		const state = proofState();
		if (state) {
			state.phase = next;
			state.owner = current?.id;
		}
	}
	function releaseMotion(owner: Owner, completed: boolean, reason?: string) {
		if (owner.ended) return;
		owner.ended = true;
		cancelAnimationFrame(owner.frame);
		trace(completed ? 'motion-ended' : 'motion-aborted', {
			owner: owner.id,
			href: owner.href,
			reason
		});
		owner.release(completed);
		if (completed && current === owner) setPhase('holding');
	}
	function stop(reason: string) {
		const previous = current;
		if (!previous) return;
		previous.cancelled = true;
		releaseMotion(previous, false, reason);
		previous.animation?.cancel();
		trace('owner-ended', { owner: previous.id, href: previous.href, reason });
		current = undefined;
		permit = undefined;
		setPhase('idle');
	}
	function begin(navigation: Pick<NavigationBase, 'to' | 'complete'>) {
		stop('superseded');
		let release!: Owner['release'];
		const motion = new Promise<boolean>((resolve) => {
			release = resolve;
		});
		const owner: Owner = {
			id: ++generation,
			href: navigation.to!.url.href,
			complete: navigation.complete,
			motion,
			release,
			frame: 0,
			ended: false,
			cancelled: false,
			committing: false
		};
		current = owner;
		setPhase('moving');
		trace('owner-started', { owner: owner.id, href: owner.href, strategy });
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const startX = actor.getBoundingClientRect().x;
		let moved = false,
			previousFrame = 0;
		owner.animation = actor.animate(
			[{ transform: 'translateX(0)' }, { transform: 'translateX(120px)' }],
			{ duration: reduced ? 0 : motionDuration, easing: 'linear', fill: 'forwards' }
		);
		trace('motion-started', { owner: owner.id, href: owner.href, reduced });
		const sample = (time: number) => {
			if (owner.cancelled || current !== owner) return;
			const x = actor.getBoundingClientRect().x;
			if (!moved && x - startX > 0.5) {
				moved = true;
				trace('first-movement', { owner: owner.id, href: owner.href, x });
			}
			trace('animation-frame', {
				owner: owner.id,
				x,
				interval: previousFrame ? time - previousFrame : 0
			});
			previousFrame = time;
			if (!owner.ended) owner.frame = requestAnimationFrame(sample);
		};
		owner.frame = requestAnimationFrame(sample);
		void owner.animation.finished
			.then(() => {
				if (!owner.cancelled) releaseMotion(owner, true);
			})
			.catch(() => releaseMotion(owner, false, 'animation-cancelled'));
		return owner;
	}
	function settle(owner: Owner) {
		if (current !== owner || owner.cancelled) return;
		owner.animation?.cancel();
		cancelAnimationFrame(owner.frame);
		trace('owner-ended', { owner: owner.id, href: owner.href, reason: 'committed' });
		current = undefined;
		permit = undefined;
		setPhase('idle');
	}
	async function commit(owner: Owner, destination = owner.href) {
		if (current !== owner || owner.cancelled) return;
		owner.committing = true;
		owner.href = new URL(destination, owner.href).href;
		permit = { owner: owner.id, href: owner.href };
		setPhase('committing');
		trace('goto-requested', { owner: owner.id, href: owner.href });
		try {
			await goto(owner.href);
		} catch (error) {
			trace('goto-rejected', { owner: owner.id, message: String(error) });
		} finally {
			settle(owner);
		}
	}
	async function loadAndCommit(owner: Owner) {
		try {
			trace('preload-started', { owner: owner.id, href: owner.href });
			const data = await preloadData(owner.href);
			if (current !== owner || owner.cancelled) {
				trace('stale-data-ignored', { owner: owner.id, href: owner.href });
				return;
			}
			trace('data-ready', {
				owner: owner.id,
				href: owner.href,
				type: data.type,
				status: data.type === 'loaded' ? data.status : undefined
			});
			if (data.type === 'redirect') {
				// The predicted target is no longer correct. End its motion and let
				// one ordinary public navigation follow the resolved destination.
				releaseMotion(owner, false, 'redirect');
				owner.animation?.cancel();
				trace('redirect-followed', { owner: owner.id, href: data.location });
				await commit(owner, data.location);
				return;
			}
			if (await owner.motion) await commit(owner);
		} catch (error) {
			trace('preload-rejected', { owner: owner.id, message: String(error) });
			if (await owner.motion) await commit(owner);
		}
	}

	beforeNavigate((navigation) => {
		if (!ready) return;
		if (permit && current?.id === permit.owner && navigation.to?.url.href === permit.href) {
			trace('goto-accepted', { owner: current.id, href: permit.href });
			permit = undefined;
			return;
		}
		if (navigation.willUnload || !belongs(navigation.to?.url) || navigation.type === 'popstate') {
			stop(navigation.type === 'popstate' ? 'history' : 'leave');
			trace('native-navigation', { href: navigation.to?.url.href, type: navigation.type });
			return;
		}
		if (strategy === 'gate') {
			const owner = begin(navigation);
			gateOwners.set(navigation.complete, owner);
			void navigation.complete.catch(() => {
				if (current === owner) stop('router-cancelled');
			});
		} else {
			navigation.cancel();
			void navigation.complete.catch(() => {});
			const owner = begin(navigation);
			trace('original-navigation-cancelled', { owner: owner.id, href: owner.href });
			void loadAndCommit(owner);
		}
	});

	$effect(() => {
		const complete = navigating.complete,
			to = navigating.to;
		// Kit can omit beforeNavigate for a superseding navigation. Its public
		// navigating.complete identity still starts the successor's visual owner.
		if (strategy !== 'gate' || !ready || !complete || !belongs(to?.url) || gateOwners.has(complete))
			return;
		const owner = begin({ complete, to });
		gateOwners.set(complete, owner);
	});

	onNavigate(async (navigation) => {
		trace('on-navigate', { href: navigation.to?.url.href });
		if (strategy !== 'gate' || !belongs(navigation.to?.url)) return;
		let owner = gateOwners.get(navigation.complete);
		if (!owner) {
			owner = begin(navigation);
			gateOwners.set(navigation.complete, owner);
		}
		trace('data-ready', { owner: owner.id, href: owner.href });
		trace('gate-waiting', { owner: owner.id, href: owner.href });
		await owner.motion;
		trace('gate-released', {
			owner: owner.id,
			href: owner.href,
			stale: current !== owner || owner.cancelled
		});
		return () => {
			trace('gate-dom-complete', {
				owner: owner.id,
				href: owner.href,
				stale: current !== owner || owner.cancelled
			});
			settle(owner);
		};
	});

	afterNavigate((navigation) => {
		trace('route-committed', {
			href: navigation.to?.url.href,
			type: navigation.type,
			slug: document.querySelector('[data-proof-page]')?.getAttribute('data-proof-page')
		});
	});
	onMount(() => {
		ready = true;
		const state = proofState()!;
		state.ready = true;
		state.cancel = () => stop('user-cancelled');
		state.warm = async (destination) => {
			await preloadData(destination);
			trace('warmed', { href: destination });
		};
		const click = (event: MouseEvent) => {
			const link = (event.target as Element).closest<HTMLAnchorElement>('[data-proof-link]');
			if (link)
				trace('click', {
					href: link.href,
					modified: event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
				});
		};
		document.addEventListener('click', click, true);
		return () => {
			document.removeEventListener('click', click, true);
			state.ready = false;
		};
	});
	onDestroy(() => {
		stop('destroyed');
		gateOwners.clear();
	});
	async function warmBoth() {
		warmed = false;
		await preloadData(href('other'));
		await preloadData(href('target'));
		warmed = true;
		trace('both-warmed');
	}
</script>

<svelte:head><title>Staged navigation public API proof</title></svelte:head>
<main
	data-staged-proof
	data-ready={ready}
	data-phase={phase}
	data-strategy={strategy}
	data-warmed={warmed}
>
	<nav aria-label="Proof routes" data-sveltekit-preload-data="off">
		<a data-proof-link href={href('source')}>Source</a>
		<a data-proof-link href={href('target')}>Fast target</a>
		<a data-proof-link href={href('target', 1200)}>Slow target</a>
		<a data-proof-link href={href('other')}>Other target</a>
		<a data-proof-link href={href('failure')}>Failure</a>
		<a data-proof-link href={href('redirect')}>Redirect</a>
	</nav>
	<p>Strategy: {strategy}. Current phase: <strong>{phase}</strong>.</p>
	<div class="motion-space">
		<div bind:this={actor} class="source-actor" data-proof-actor>Existing source</div>
	</div>
	<div class="actions">
		<button type="button" onclick={warmBoth}>Warm both targets</button>
		<button type="button" onclick={() => stop('user-cancelled')}>Cancel pending movement</button>
	</div>
	{@render children()}
</main>

<style>
	:global(body) {
		margin: 0;
		font:
			16px/1.5 system-ui,
			sans-serif;
		background: white;
		color: #10243a;
	}
	main {
		max-width: 1000px;
		margin: 0 auto;
		padding: 32px;
	}
	nav,
	.actions {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 20px;
	}
	.motion-space {
		padding: 12px 0;
		height: 110px;
	}
	.source-actor {
		display: grid;
		place-items: center;
		width: 180px;
		height: 90px;
		border-radius: 12px;
		color: white;
		background: #0b83d5;
		will-change: transform;
	}
	button,
	a {
		font: inherit;
	}
</style>
