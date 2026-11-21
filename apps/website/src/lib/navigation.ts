import { resolve } from '$app/paths';
import type { MenuItem } from '@page-sections/core';
import { showcaseSegments } from './showcase/segments';
import { documents } from './catalog';
const groups = [
	['Foundations', 'foundations', 'layers'],
	['Pages and sections', 'sections', 'panels'],
	['Interaction', 'interaction', 'blocks'],
	['Examples', 'examples', 'code'],
	['Advanced', 'advanced', 'settings'],
	['Reference', 'reference', 'book']
];
const navigationTree: MenuItem[] = [
	{
		id: 'showcase',
		label: 'Showcase',
		href: '/showcase/',
		children: showcaseSegments.map((segment) => ({
			id: segment.id,
			label: segment.title,
			href: '/showcase/' + segment.id + '/'
		}))
	},
	{ id: 'start', label: 'Getting started', href: '/getting-started/' },
	{
		id: 'docs',
		label: 'Documentation',
		href: '/docs/',
		children: groups.map(([label, slug, icon]) => ({
			id: slug,
			label,
			icon,
			href: '/docs/' + slug + '/',
			children: documents
				.filter((d) => d.group === label)
				.map((d) => ({ id: d.href, label: d.title, href: d.href }))
		}))
	},
	{ id: 'about', label: 'About', href: '/about/' }
];
const flatten = (items: MenuItem[]): MenuItem[] =>
	items.flatMap((item) => [item, ...flatten(item.children ?? [])]);
export function getNavigationTree(url: Pick<URL, 'href' | 'pathname'>): MenuItem[] {
	const mapped = (items: MenuItem[]): MenuItem[] =>
		items.map((item) => ({
			...item,
			href: new URL(resolve('/') + item.href.slice(1), url.href).pathname,
			children: item.children ? mapped(item.children) : undefined
		}));
	return mapped(navigationTree);
}
export function readingNeighbors(url: Pick<URL, 'href' | 'pathname'>) {
	const readingOrder = flatten(
		getNavigationTree(url).filter((item) => item.id === 'start' || item.id === 'docs')
	);
	const index = readingOrder.findIndex((item) => item.href === url.pathname);
	return index < 0 ? {} : { previous: readingOrder[index - 1], next: readingOrder[index + 1] };
}
