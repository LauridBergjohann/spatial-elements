import { error } from '@sveltejs/kit';import { products } from '$lib/catalog';import type { PageLoad } from './$types';
export const load: PageLoad = ({params}) => {const product=products.find(p=>p.id===params.productId);if(!product)error(404,'Unknown form');return {product};};
