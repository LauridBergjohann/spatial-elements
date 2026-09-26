import { error } from '@sveltejs/kit';import { spatialElements } from '$lib/catalog';import type { PageLoad } from './$types';
export const load: PageLoad = ({params}) => {const spatialElement=spatialElements.find(p=>p.id===params.spatialElementId);if(!spatialElement)error(404,'Unknown form');return {spatialElement};};
