<script lang="ts">
	import { Footer } from '@page-sections/svelte';
	import { page } from '$app/state';
	import { resolve, asset } from '$app/paths';
	import Globe from '@lucide/svelte/icons/globe';
	import BrandMark from './BrandMark.svelte';
	import LinkedIn from './LinkedInMark.svelte';
	import Github from './GitHubMark.svelte';
	import { getNavigationTree } from './navigation';
	import { version } from '../../../../packages/sveltekit/package.json';
	const navigation = $derived(getNavigationTree(page.url));
	const menu = $derived([
		{
			label: 'Spatial Elements',
			href: resolve('/'),
			links: navigation
				.filter((item) => item.id === 'start' || item.id === 'about')
				.map((item) => ({ label: item.label, href: item.href }))
		},
		...navigation
			.filter((item) => item.children?.length)
			.map((item) => ({
				label: item.label,
				href: item.href,
				links: item.children?.map((child) => ({ label: child.label, href: child.href })) ?? []
			})),
		{
			label: 'Resources',
			links: [
				{ label: 'Source code', href: 'https://github.com/LauridBergjohann/spatial-elements' },
				{ label: 'NPM package', href: 'https://www.npmjs.com/package/@spatial-elements/sveltekit' },
				{ label: 'Page Sections', href: 'https://page-sections.bergjohann.com/' }
			]
		}
	]);
</script>

{#snippet githubIcon()}<Github />{/snippet}
{#snippet npmIcon()}<BrandMark kind="npm" />{/snippet}
{#snippet vercelIcon()}<BrandMark kind="vercel" />{/snippet}
{#snippet svelteIcon()}<BrandMark kind="svelte" />{/snippet}
{#snippet linkedinIcon()}<LinkedIn />{/snippet}
{#snippet globeIcon()}<Globe aria-hidden="true" />{/snippet}

<Footer
	class="site-footer"
	footnote="© 2026 Spatial Elements."
	{menu}
	links={[
		{ label: 'Imprint', href: resolve('about/#impressum') },
		{ label: 'Privacy', href: resolve('about/#datenschutz') },
		{
			label: 'Licence',
			href: 'https://github.com/LauridBergjohann/spatial-elements/blob/main/LICENSE'
		}
	]}
	social={[
		{
			label: 'GitHub',
			href: 'https://github.com/LauridBergjohann/spatial-elements',
			icon: githubIcon
		},
		{
			label: 'NPM',
			href: 'https://www.npmjs.com/package/@spatial-elements/sveltekit',
			icon: npmIcon
		},

		{ label: 'Vercel', href: 'https://vercel.com/', icon: vercelIcon },
		{ label: 'Bergjohann', href: 'https://bergjohann.com/', icon: globeIcon },
		{
			label: 'LinkedIn',
			href: 'https://www.linkedin.com/in/laurid-bergjohann',
			icon: linkedinIcon
		},
		{ label: 'Svelte', href: 'https://svelte.dev/', icon: svelteIcon }
	]}
>
	{#snippet brand()}
		<a class="site-brand" href={resolve('/')}>
			<img src={asset('spatial-elements-logo-footer.svg')} alt="" width="32" height="32" />
			Spatial Elements <span class="version">v{version}</span>
		</a>
		<p>Bring a new dimension to your website.</p>
	{/snippet}
</Footer>
