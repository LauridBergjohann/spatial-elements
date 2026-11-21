import { redirect } from '@sveltejs/kit';
export function load() {
	redirect(308, '/docs/detail-pages/summaries/');
}
