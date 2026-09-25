/** One resource owner at a time; transfer invalidates all earlier release callbacks. */
export class PresentationLease<T> {
	private owner: object = {};
	private released = false;
	private transfers = 0;
	constructor(
		readonly value: T,
		private readonly dispose: (value: T) => void
	) {}

	claim() {
		if (this.released) throw new Error('Cannot adopt a released presentation');
		const owner = (this.owner = {});
		this.transfers++;
		return {
			value: this.value,
			isCurrent: () => !this.released && this.owner === owner,
			release: () => {
				if (this.released || this.owner !== owner) return false;
				this.released = true;
				this.dispose(this.value);
				return true;
			}
		};
	}

	get revision() {
		return this.transfers;
	}
}
