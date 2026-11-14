import { getContext, setContext } from 'svelte';

const ORDERS = Symbol('showcase-orders');

/** Created per layout/request, never shared between SSR visitors. */
export class ShowcaseOrders {
	quantities = $state<Record<string, number | undefined>>({});
	get(id: string) {
		return this.quantities[id] ?? 1;
	}
	set(id: string, value: number | undefined) {
		this.quantities[id] = Math.min(99, Math.max(1, Math.round(value ?? 1)));
	}
}

export function provideShowcaseOrders() {
	return setContext(ORDERS, new ShowcaseOrders());
}

export function useShowcaseOrders() {
	return getContext<ShowcaseOrders>(ORDERS);
}
