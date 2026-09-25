import { redirect } from '@sveltejs/kit';
export function load() { redirect(307, '/demo/categories/mixed'); }
