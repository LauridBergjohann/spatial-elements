<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { afterNavigate } from '$app/navigation';
	import { IconButton, Popup } from '@page-sections/svelte';
	import Search from '@lucide/svelte/icons/search';
	import { showcaseSegments } from './showcase/segments';
	import { showcaseProducts } from './showcase/products';
	import { documents } from './catalog';
	import { referenceDocuments } from './docs/referenceIndex';

	const entries = [
		...documents,
		...referenceDocuments,
		{
			title: 'Getting started',
			href: '/getting-started/',
			group: 'Start here',
			description: 'Install Spatial Elements and build your first collection.'
		},
		...showcaseSegments.map((segment) => ({
			title: segment.title,
			href: '/showcase/' + segment.id + '/',
			group: 'Showcase',
			description: segment.description
		})),
		...showcaseProducts.map((product) => ({
			title: product.productNumber ? `${product.productNumber} · ${product.title}` : product.title,
			href: product.href,
			group: 'Showcase ? ' + product.segment.title,
			description: product.description
		})),
		{
			title: 'About',
			href: '/about/',
			group: 'Project',
			description: 'Motivation, imprint and privacy.'
		}
	];
	let ready = $state(false);
	let compact = $state(false);
	let root = $state<HTMLDivElement>();
	let input = $state<HTMLInputElement>();
	let trigger = $state<HTMLButtonElement | HTMLAnchorElement>();
	let query = $state('');
	let opened = $state(false);
	let active = $state(-1);
	const words = $derived(query.trim().toLowerCase().split(/\s+/).filter(Boolean));
	function relevance(item: (typeof entries)[number]) {
		const title = item.title.toLowerCase();
		return (
			(title === query.trim().toLowerCase() ? 20 : 0) +
			words.filter((word) => title.includes(word)).length * 5
		);
	}
	const found = $derived(
		entries
			.filter((item) =>
				words.every((word) =>
					`${item.title} ${item.description} ${item.group} ${item.href}`
						.toLowerCase()
						.includes(word)
				)
			)
			.sort((a, b) => relevance(b) - relevance(a))
	);
	const matches = $derived(found.slice(0, 10));
	onMount(() => {
		const media = matchMedia(
			'(max-width: 799.98px), (min-width: 1200px) and (max-width: 1599.98px)'
		);
		const update = () => {
			compact = media.matches;
			dismiss();
		};
		update();
		ready = true;
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	});
	$effect(() => {
		void query;
		active = -1;
	});
	afterNavigate(() => {
		opened = false;
		query = '';
	});

	async function focusSearch() {
		opened = true;
		await tick();
		input?.focus();
		input?.select();
	}
	function dismiss(restoreFocus = false) {
		opened = false;
		active = -1;
		if (restoreFocus && trigger?.getClientRects().length) trigger.focus();
	}
	function shortcut(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			void focusSearch();
		}
		if (event.key === 'Escape' && opened) {
			event.preventDefault();
			dismiss(true);
		}
	}
	function inputKey(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			opened = true;
			if (!matches.length) return;
			active =
				event.key === 'ArrowDown'
					? (active + 1) % matches.length
					: active < 0
						? matches.length - 1
						: (active - 1 + matches.length) % matches.length;
			void tick().then(() =>
				document
					.getElementById(`site-search-result-${active}`)
					?.scrollIntoView({ block: 'nearest' })
			);
		} else if (event.key === 'Enter' && opened && matches.length) {
			event.preventDefault();
			document.getElementById(`site-search-result-${Math.max(active, 0)}`)?.click();
		}
	}
</script>

<svelte:window
	onkeydown={shortcut}
	onresize={() => dismiss()}
	onpointerdown={(event) => {
		if (event.target instanceof Node && !root?.contains(event.target)) dismiss();
	}}
/>

<div
	class="site-search"
	class:opened
	bind:this={root}
	onfocusout={(event) => {
		if (!(event.relatedTarget instanceof Node) || !root?.contains(event.relatedTarget)) dismiss();
	}}
>
	{#if ready}
		<IconButton
			label="Open search"
			active={opened}
			borderless
			class="mobile-search"
			bind:element={trigger}
			type="button"
			aria-label="Open search"
			aria-expanded={opened}
			aria-controls="site-search-field"
			onclick={() => (opened ? dismiss(true) : void focusSearch())}
		>
			<Search size={20} aria-hidden="true" />
		</IconButton>
		<Popup
			class="search-surface"
			inline={!compact}
			open={!compact || opened}
			anchor={trigger}
			onclose={() => dismiss()}
			style="padding: 0"
		>
			<div class="search-field" id="site-search-field">
				<Search size={18} aria-hidden="true" />
				<input
					bind:this={input}
					bind:value={query}
					type="search"
					role="combobox"
					aria-label="Search documentation"
					placeholder="Search…"
					autocomplete="off"
					spellcheck="false"
					aria-keyshortcuts="Control+k Meta+k"
					aria-autocomplete="list"
					aria-expanded={opened}
					aria-controls={opened ? 'site-search-results' : undefined}
					aria-activedescendant={opened && active >= 0 ? `site-search-result-${active}` : undefined}
					onfocus={() => {
						opened = true;
					}}
					oninput={() => {
						opened = true;
					}}
					onkeydown={inputKey}
				/>
				<kbd aria-hidden="true">Ctrl K</kbd>
			</div>
			{#if opened}
				<Popup
					class="search-panel"
					inline={compact}
					onclose={() => dismiss()}
					anchor={input}
					style="padding: 0"
				>
					<p class="search-hint" role="status">
						{query.trim()
							? `${found.length} matching ${found.length === 1 ? 'topic' : 'topics'}${found.length > 10 ? ' · showing the first 10' : ''}`
							: 'Explore the guides and examples'}
					</p>
					<ul id="site-search-results" role="listbox" aria-label="Search results">
						{#each matches as item, index}
							<li role="presentation">
								<a
									id={`site-search-result-${index}`}
									href={resolve('/') + item.href.slice(1)}
									role="option"
									aria-selected={active === index}
									tabindex="-1"
								>
									<span class="result-group">{item.group}</span>
									<strong>{item.title}</strong>
									<span>{item.description}</span>
								</a>
							</li>
						{/each}
					</ul>
					{#if !matches.length}<p class="empty">
							No matching topics. Try “cards”, “theme” or “CodeBlock”.
						</p>{/if}
					<p class="search-hint">↑ ↓ to choose · Enter to open · Esc to close</p>
				</Popup>
			{/if}
		</Popup>
	{:else}
		<a class="search-fallback" href={resolve('/docs')} aria-label="Browse documentation">
			<Search size={18} aria-hidden="true" /><span>Browse documentation</span>
		</a>
	{/if}
</div>

<style>
	.site-search {
		position: relative;
		width: clamp(14rem, 18vw, 18rem);
	}
	.search-field,
	.search-fallback {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		height: 40px;
		padding: 0 0.75rem;
		border: 1px solid var(--ps-border);
		border-radius: 0.6rem;
		color: var(--ps-body);
		background: var(--ps-section-standard);
	}
	.search-field:focus-within {
		outline: 2px solid var(--ps-accent);
		outline-offset: 2px;
	}
	input {
		width: 100%;
		min-width: 0;
		border: 0;
		padding: 0;
		font: inherit;
		font-size: 0.875rem;
		color: var(--ps-ink);
		background: transparent;
		outline: none;
	}
	kbd {
		flex-shrink: 0;
		font-size: 0.7rem;
		border: 1px solid var(--ps-border);
		border-radius: 0.25rem;
		padding: 0.2rem 0.3rem;
	}

	.site-search :global(.mobile-search) {
		display: none;
	}
	.site-search :global(.search-panel) {
		top: 100%;
		right: 0;
		z-index: 5;
		width: 30rem;
		max-width: calc(100vw - 24px);
		border-top-width: 0;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0.4rem;
		overflow: auto;
		max-height: min(28rem, 55dvh);
	}
	a[role='option'] {
		display: grid;
		gap: 0.2rem;
		padding: 0.75rem;
		border-radius: 0.5rem;
		color: var(--ps-ink);
		text-decoration: none;
		white-space: normal;
		font-size: 0.875rem;
	}
	a[aria-selected='true'],
	a[role='option']:hover {
		background: var(--ps-section-muted);
	}
	a[role='option'] > span {
		color: var(--ps-body);
	}
	.result-group {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.search-hint,
	.empty {
		padding: 0.75rem 1rem;
		margin: 0;
		font-size: 0.8rem;
		color: var(--ps-body);
	}
	.search-hint {
		border-block: 1px solid var(--ps-border);
	}

	:global(.search-surface) {
		display: contents;
	}

	@media (max-width: 799.98px), (min-width: 1200px) and (max-width: 1599.98px) {
		.site-search {
			position: static;
			width: 40px;
		}
		:global(.search-surface) {
			display: none;
		}
		.site-search :global(.mobile-search) {
			display: inline-flex;
		}
		.search-fallback {
			display: grid;
			place-items: center;
			padding: 0;
			width: 40px;
			height: 40px;
			border: 0;
			border-radius: 0.5rem;
			background: transparent;
			color: var(--ps-ink);
			cursor: pointer;
		}
		.search-fallback span,
		kbd {
			display: none;
		}
		.opened :global(.search-surface) {
			display: block;
			position: absolute;
			top: 100%;
			left: 12px;
			right: 12px;
			width: auto;
			z-index: 5;
			border-top-width: 0;
			max-height: calc(100dvh - var(--ps-nav-height) - 24px);
		}
		.search-field {
			margin: 12px;
		}
		.site-search :global(.search-panel) {
			position: static;
			width: auto;
			max-width: none;
			border: 0;
			border-radius: 0;
			background: transparent;
			box-shadow: none;
		}
		ul {
			max-height: min(24rem, 45dvh);
		}
	}
</style>
