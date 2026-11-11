import { error, redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { trace } from '$lib/staged-navigation-proof/telemetry';
import type { PageLoad } from './$types';

// An ordinary application cache makes both A and B data-warm simultaneously.
// This does not read or manipulate SvelteKit's private, single-entry preload cache.
const dataCache = new Map<string, { slug: string; requestId: string }>();

export const load: PageLoad = async ({ params, url, fetch }) => {
	const key = `${params.slug}/${url.searchParams.get('delay') ?? '0'}/${url.searchParams.get('ticket') ?? ''}`;
	trace('load-start', { href: url.href, slug: params.slug });
	let data = browser ? dataCache.get(key) : undefined;
	if (!data) {
		const query = new URLSearchParams({
			slug: params.slug,
			delay: url.searchParams.get('delay') ?? '0'
		});
		const response = await fetch(`/proof/staged-navigation/data?${query}`);
		if (!response.ok) {
			trace('load-error', { href: url.href, status: response.status });
			error(response.status, 'Deliberate navigation proof failure');
		}
		data = await response.json();
		if (browser) dataCache.set(key, data!);
	} else trace('load-cache-hit', { href: url.href, slug: params.slug });
	trace('load-ready', { href: url.href, slug: params.slug });
	if (params.slug === 'redirect') {
		const destination = new URL(url);
		destination.pathname = '/proof/staged-navigation/other';
		redirect(307, destination.href);
	}
	return { slug: params.slug, requestId: data!.requestId };
};
