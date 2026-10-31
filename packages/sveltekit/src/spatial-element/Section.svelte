<script lang="ts">
	import { getContext, onDestroy, onMount } from 'svelte';
	import { dev } from '$app/environment';
	import './layout.generated.css';
	import { createSectionBackgroundNormalizer } from '@spatial-elements/core/spatial-element/sectionBackground';
	import { SECTION_SURFACES, type SectionSurfaceRegistry } from '@spatial-elements/core/spatial-element/SectionSurfaceRegistry';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { getSpatialElementSectionStyle } from '@spatial-elements/core/spatial-element/spatialElement';
	import {
		SPATIAL_ELEMENT_SECTION_REGISTRY_KEY,
		SECTION_PAGE_KIND,
		type SpatialElementSectionRegistry
	} from '@spatial-elements/core/spatial-element/spatialElementSectionRegistry';
	import type { SpatialElementSectionDefinition } from '@spatial-elements/core/spatial-element/types';

	type Props = Omit<HTMLAttributes<HTMLElement>, 'class' | 'id' | 'style'> & {
		/** Metadata used for the section anchor, heading, generated tab, and optional shell styling. */
		section: SpatialElementSectionDefinition;
		/** Arbitrary Svelte content owned by the consuming element route. */
		children?: Snippet;
		class?: string;
		presentation?: 'panel' | 'list';
	};

	let {
		section,
		children,
		class: className = '',
		presentation = 'panel',
		...rest
	}: Props = $props();
	let sectionElement: HTMLElement;

	const contentPage = getContext(SECTION_PAGE_KIND) === 'content';
	const normalizeBackground = createSectionBackgroundNormalizer(dev ? (diagnostic) => console.warn(diagnostic.message) : undefined);
	const background = $derived(normalizeBackground(section.background, { pageKind: contentPage ? 'content' : 'detail' }));
	const legacyMaterial = $derived(!section.background && Boolean(section.style &&
		(section.style.tint !== undefined || section.style.tintOpacity !== undefined || section.style.backdropBlur !== undefined)));
	const surface = $derived(legacyMaterial ? { ...background, color: 'standard' as const } : background);
	const surfaces = getContext<SectionSurfaceRegistry | undefined>(SECTION_SURFACES);
	function registerSurface() { return surfaces?.register(surface); }
	const surfaceRegistration = registerSurface();
	onDestroy(() => surfaceRegistration?.unregister());
	$effect(() => surfaceRegistration?.update(surface));
	const registry = getContext<SpatialElementSectionRegistry>(SPATIAL_ELEMENT_SECTION_REGISTRY_KEY);
	if (!registry) {
		throw new Error(
			'Section must be rendered inside a ContentPage or SpatialElementPage component.'
		);
	}

	function registerSection() {
		return registry.register(section);
	}

	const registration = registerSection();
	onDestroy(registration.unregister);

	// Keep generated navigation current when a route changes section metadata reactively.
	$effect(() => registration.update(section));

	onMount(() => {
		// Content-page card endpoints must stay measurable, including restored offscreen lists.
		if (contentPage) return;
		let measurementFrame = 0;
		let observer: IntersectionObserver | undefined;

		const setNearViewport = (nearViewport: boolean) => {
			sectionElement.toggleAttribute('data-spatial-element-section-near-viewport', nearViewport);
			sectionElement.toggleAttribute('data-spatial-element-section-culled', !nearViewport);
		};
		const measureIntrinsicHeight = () => {
			measurementFrame = 0;
			const style = getComputedStyle(sectionElement);
			const blockChrome =
				(Number.parseFloat(style.paddingTop) || 0) +
				(Number.parseFloat(style.paddingBottom) || 0) +
				(Number.parseFloat(style.borderTopWidth) || 0) +
				(Number.parseFloat(style.borderBottomWidth) || 0);
			// contain-intrinsic-block-size describes the content box. Supplying the
			// measured border-box height would add padding a second time while skipped.
			const intrinsicHeight = Math.max(
				sectionElement.getBoundingClientRect().height - blockChrome,
				1
			);
			sectionElement.style.setProperty(
				'--spatial-element-section-intrinsic-height',
				`${intrinsicHeight}px`
			);
			sectionElement.setAttribute('data-spatial-element-section-culling-ready', '');
		};
		const prepareMeasurement = () => {
			sectionElement.removeAttribute('data-spatial-element-section-culling-ready');
			if (measurementFrame) cancelAnimationFrame(measurementFrame);
			measurementFrame = requestAnimationFrame(measureIntrinsicHeight);
		};

		const rect = sectionElement.getBoundingClientRect();
		setNearViewport(rect.bottom >= -240 && rect.top <= window.innerHeight + 240);
		measureIntrinsicHeight();

		if ('IntersectionObserver' in window) {
			observer = new IntersectionObserver(([entry]) => setNearViewport(entry.isIntersecting), {
				rootMargin: '240px 0px'
			});
			observer.observe(sectionElement);
		}
		window.addEventListener('resize', prepareMeasurement, { passive: true });

		return () => {
			observer?.disconnect();
			window.removeEventListener('resize', prepareMeasurement);
			if (measurementFrame) cancelAnimationFrame(measurementFrame);
		};
	});
</script>

<section
	bind:this={sectionElement}
	{...rest}
	id={section.id}
	class={['content-section spatial-grid-scope', contentPage ? 'content-page-section' : '', className]
		.filter(Boolean)
		.join(' ')}
	data-stage-dom-content
	data-spatial-element-tab-target={!contentPage || undefined}
	data-catalog-transition-dom={contentPage ? 'exit' : undefined}
	data-section-presentation={presentation}
	data-section-background={surface.color}
	data-section-background-size={surface.size}
	data-spatial-section-surface={surfaceRegistration?.id}
	aria-labelledby={section.headline ? `${section.id}-title` : undefined}
	aria-label={section.headline ? undefined : section.title}
	style={getSpatialElementSectionStyle(section.style)}
>
	<span class="section-surface spatial-section-surface" class:legacy-material={legacyMaterial}
		style:background={legacyMaterial ? undefined : background.cssBackground} aria-hidden="true"></span>
	{#if section.headline}
		<h2 id={`${section.id}-title`} class="section-kicker">{section.headline}</h2>
	{/if}
	{@render children?.()}
</section>

<style>
	.content-section {
		position: relative;
		isolation: isolate;
		scroll-margin-top: var(--spatial-element-section-scroll-offset, 150px);
		width: min(var(--spatial-element-section-width, 100%), 100%);
		box-sizing: border-box;
		margin: 0;
		padding: var(--spatial-grid-gap);
		color: var(--spatial-element-section-color, var(--spatial-element-ink));
		font-size: var(--spatial-grid-body-size);
		line-height: var(--spatial-grid-body-line-height);
		pointer-events: auto;
	}
	.section-surface {
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
	}
	.content-section[data-section-background-size='full'] .section-surface {
		left: 50%;
		right: auto;
		width: 100vw;
		transform: translateX(-50%);
	}
	.legacy-material {
		background: color-mix(
			in srgb,
			var(--spatial-element-section-tint) var(--spatial-element-section-tint-opacity),
			transparent
		);
		box-shadow: 0 20px 45px rgb(27 55 89 / 0.08);
		-webkit-backdrop-filter: blur(min(var(--spatial-element-section-backdrop-blur), 18px));
		backdrop-filter: blur(min(var(--spatial-element-section-backdrop-blur), 18px));
	}

	.content-section[data-spatial-element-section-culling-ready] {
		content-visibility: auto;
		contain-intrinsic-block-size: auto var(--spatial-element-section-intrinsic-height);
	}

	/*
	 * Do not retain a full-width backdrop-compositing layer for distant sections.
	 * The 240px observer margin recreates it before the section can enter the viewport.
	 */
	.content-section[data-spatial-element-section-culled] .section-surface {
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}

	.section-kicker {
		margin: 0 0 var(--spatial-grid-headline-gap);
		font-size: var(--spatial-grid-headline-size);
		font-weight: 600;
		line-height: var(--spatial-grid-headline-line-height);
	}
</style>
