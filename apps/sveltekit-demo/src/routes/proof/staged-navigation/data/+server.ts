import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const delay = Math.min(2000, Math.max(0, Number(url.searchParams.get('delay')) || 0));
	if (delay) await new Promise(resolve => setTimeout(resolve, delay));
	const slug = url.searchParams.get('slug') ?? 'source';
	return json({ slug, requestId: crypto.randomUUID() }, {
		status: slug === 'failure' ? 503 : 200,
		headers: { 'cache-control': 'no-store' }
	});
};
