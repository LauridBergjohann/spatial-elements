import { base } from '$app/paths';
import type { MenuItem } from '@page-sections/core';
import { documents } from './catalog';
const groups = [
	['Foundations', 'foundations', 'layers'],
	['Pages and sections', 'sections', 'panels'],
	['Interaction', 'interaction', 'blocks'],
	['Examples', 'examples', 'code'],
	['Advanced', 'advanced', 'settings'],
	['Reference', 'reference', 'book']
];
export const navigationTree: MenuItem[] = [
	{
		id: 'showcase',
		label: 'Showcase',
		href: base + '/showcase/',
		children: [
			{ id: 'wera', label: 'Wera tools', href: base + '/showcase/wera/', icon: 'briefcase' },
			{ id: 'watches', label: 'The watch', href: base + '/showcase/watches/', icon: 'layers' }
		]
	},
	{ id: 'start', label: 'Getting started', href: base + '/getting-started/' },
	{
		id: 'docs',
		label: 'Documentation',
		href: base + '/docs/',
		children: groups.map(([label, slug, icon]) => ({
			id: slug,
			label,
			icon,
			href: base + '/docs/' + slug + '/',
			children: documents
				.filter((d) => d.group === label)
				.map((d) => ({ id: d.href, label: d.title, href: base + d.href }))
		}))
	},
	{ id: 'about', label: 'About', href: base + '/about/' }
];
const flatten = (items: MenuItem[]): MenuItem[] =>
	items.flatMap((item) => [item, ...flatten(item.children ?? [])]);
export const readingOrder = flatten(
	navigationTree.filter((item) => item.id === 'start' || item.id === 'docs')
);
export function readingNeighbors(pathname: string) {
	const index = readingOrder.findIndex((item) => item.href === pathname);
	return index < 0 ? {} : { previous: readingOrder[index - 1], next: readingOrder[index + 1] };
}
