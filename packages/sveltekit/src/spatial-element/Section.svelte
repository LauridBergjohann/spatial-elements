<script lang="ts">
	import { Section as PageSection } from '@page-sections/svelte';
	import { getContext, onMount } from 'svelte';
	import { dev } from '$app/environment';
	import './layout.generated.css';
	import { createSectionBackgroundNormalizer } from '@spatial-elements/core/spatial-element/sectionBackground';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { getSpatialElementSectionStyle } from '@spatial-elements/core/spatial-element/spatialElement';
	import {
		SECTION_PAGE_KIND
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
	onMount(() => {
        sectionElement = document.getElementById(section.id)!;
		// Content-page card endpoints must stay measurable, including restored offscreen lists.
		if (contentPage) return;
		// Scrollspy and the virtual document need real section geometry. Skipped
		// content-visibility placeholders can change size when layout resumes and
		// move the browser's scroll anchor. Cull backdrop work, not layout height.
		let observer: IntersectionObserver | undefined;

		const setNearViewport = (nearViewport: boolean) => {
			sectionElement.toggleAttribute('data-spatial-element-section-near-viewport', nearViewport);
			sectionElement.toggleAttribute('data-spatial-element-section-culled', !nearViewport);
		};
		const rect = sectionElement.getBoundingClientRect();
		setNearViewport(rect.bottom >= -240 && rect.top <= window.innerHeight + 240);

		if ('IntersectionObserver' in window) {
			observer = new IntersectionObserver(([entry]) => setNearViewport(entry.isIntersecting), {
				rootMargin: '240px 0px'
			});
			observer.observe(sectionElement);
		}

		return () => {
			observer?.disconnect();
		};
	});
</script>

<PageSection
 {...rest} section={{ ...section, style: { width: section.style?.width, color: section.style?.textColor }, background: legacyMaterial ? { color: 'standard', size: surface.size } : section.background }}
 class={['content-section spatial-grid-scope ps-grid-scope', contentPage ? 'content-page-section' : '', className].filter(Boolean).join(' ')}
 data-spatial-legacy-material={legacyMaterial || undefined} data-stage-dom-content data-spatial-element-tab-target={!contentPage || undefined}
 data-catalog-transition-dom={contentPage ? 'exit' : undefined} data-section-presentation={presentation}
 data-section-background={surface.color} data-section-background-size={surface.size}
 style={getSpatialElementSectionStyle(section.style)}>
 {@render children?.()}
</PageSection>
<style>
 :global(.content-section) { pointer-events: auto; }
 :global(.content-section[data-spatial-legacy-material] > .ps-section-surface) { background: color-mix(in srgb, var(--spatial-element-section-tint) var(--spatial-element-section-tint-opacity), transparent) !important; backdrop-filter: blur(min(var(--spatial-element-section-backdrop-blur), 18px)); }
 :global(.content-section[data-spatial-element-section-culled] > .ps-section-surface) { backdrop-filter: none; }
</style>
