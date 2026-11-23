/** Technology cards shared with the Page Sections website, with this project's links. */
export const technologies = [
	{
		id: 'page-sections',
		title: 'Made with Page Sections',
		href: 'https://page-sections.bergjohann.com/'
	},
	{
		id: 'threejs',
		title: 'Made with three.js',
		href: 'https://threejs.org/',
		monochrome: true
	},
	{
		id: 'npm',
		title: 'Available on NPM',
		href: 'https://www.npmjs.com/package/@spatial-elements/sveltekit'
	},
	{
		id: 'github',
		title: 'Source available on GitHub',
		href: 'https://github.com/LauridBergjohann/spatial-elements',
		monochrome: true
	},
	{ id: 'vercel', title: 'Hosted on Vercel', href: 'https://vercel.com/', monochrome: true },
	{ id: 'svelte', title: 'Made for Svelte', href: 'https://svelte.dev/' },
	{ id: 'bergjohann', title: 'Developed by Laurid Bergjohann', href: 'https://bergjohann.com/' },
	{ id: 'vscode', title: 'Created in VS Code', href: 'https://code.visualstudio.com/' },
	{ id: 'codex', title: 'Supported by Codex', href: 'https://chatgpt.com/codex', monochrome: true }
].map(({ monochrome, ...item }) => ({
	...item,
	image: {
		src: `/technology/${item.id}.svg`,
		srcDark: monochrome ? `/technology/${item.id}-dark.svg` : undefined,
		alt: '',
		width: 128,
		height: 128
	}
}));
