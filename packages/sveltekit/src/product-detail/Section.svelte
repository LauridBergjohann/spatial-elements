<script lang="ts">
	import { getContext, onDestroy, onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { getProductSectionStyle } from '@spatial-elements/core/product-detail/productDetail';
	import {
		PRODUCT_SECTION_REGISTRY_KEY,
		SECTION_PAGE_KIND,
		type ProductSectionRegistry
	} from '@spatial-elements/core/product-detail/productSectionRegistry';
	import type { ProductSectionDefinition } from '@spatial-elements/core/product-detail/types';

	type Props = Omit<HTMLAttributes<HTMLElement>, 'class' | 'id' | 'style'> & {
		/** Metadata used for the section anchor, heading, generated tab, and optional shell styling. */
		section: ProductSectionDefinition;
		/** Arbitrary Svelte content owned by the consuming product route. */
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
	const registry = getContext<ProductSectionRegistry>(PRODUCT_SECTION_REGISTRY_KEY);
	if (!registry) {
		throw new Error(
			'Section must be rendered inside a ContentPage or ProductDetailPage component.'
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
			sectionElement.toggleAttribute('data-product-section-near-viewport', nearViewport);
			sectionElement.toggleAttribute('data-product-section-culled', !nearViewport);
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
				'--product-section-intrinsic-height',
				`${intrinsicHeight}px`
			);
			sectionElement.setAttribute('data-product-section-culling-ready', '');
		};
		const prepareMeasurement = () => {
			sectionElement.removeAttribute('data-product-section-culling-ready');
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
	class={['content-section', contentPage ? 'content-page-section' : '', className]
		.filter(Boolean)
		.join(' ')}
	data-stage-dom-content
	data-product-tab-target={!contentPage || undefined}
	data-catalog-transition-dom={contentPage ? 'exit' : undefined}
	data-section-presentation={presentation}
	aria-labelledby={`${section.id}-title`}
	style={getProductSectionStyle(section.style)}
>
	<svelte:element this={contentPage ? 'h2' : 'p'} id={`${section.id}-title`} class="section-kicker"
		>{section.title}</svelte:element
	>
	{@render children?.()}
</section>

<style>
	.content-section.content-page-section {
		margin-top: 24px;
		padding: 24px;
	}
	.content-section[data-section-presentation='list'] {
		padding: 0;
		background: none;
		box-shadow: none;
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}
	.content-section {
		scroll-margin-top: var(--product-section-scroll-offset, 150px);
		width: min(var(--product-section-width, 100%), 100%);
		box-sizing: border-box;
		margin: 42px 0 0;
		padding: clamp(30px, 4vw, 56px);
		border-radius: 18px;
		color: var(--product-section-color, var(--product-ink));
		background: color-mix(
			in srgb,
			var(--product-section-tint) var(--product-section-tint-opacity),
			transparent
		);
		box-shadow: 0 20px 45px rgb(27 55 89 / 0.08);
		-webkit-backdrop-filter: blur(min(var(--product-section-backdrop-blur), 18px));
		backdrop-filter: blur(min(var(--product-section-backdrop-blur), 18px));
		pointer-events: auto;
	}

	.content-section[data-product-section-culling-ready] {
		content-visibility: auto;
		contain-intrinsic-block-size: auto var(--product-section-intrinsic-height);
	}

	/*
	 * Do not retain a full-width backdrop-compositing layer for distant sections.
	 * The 240px observer margin recreates it before the section can enter the viewport.
	 */
	.content-section[data-product-section-culled] {
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}

	.content-section:last-child {
		margin-bottom: 180px;
	}

	.section-kicker {
		max-width: 780px;
		margin: 0;
		color: color-mix(in srgb, currentColor 70%, transparent);
		font-size: 18px;
		font-weight: 720;
		line-height: 1.65;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	@media (max-width: 1100px) {
		.content-section {
			width: 100%;
			margin-left: 0;
		}
	}
</style>
