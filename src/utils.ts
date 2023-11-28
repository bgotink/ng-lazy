export class Deferred<T> extends Promise<T> {
	resolve!: (value: T) => void;
	reject!: (error: unknown) => void;

	#isResolved = false;
	#value?: T;

	constructor() {
		let res: this['resolve'], rej: this['reject'];
		super((resolve, reject) => {
			res = value => {
				if (!this.#isResolved) {
					this.#value = value;
				}
				this.#isResolved = true;
				resolve(value);
			};
			rej = error => {
				this.#isResolved = true;
				reject(error);
			};
		});

		this.resolve = res!;
		this.reject = rej!;
	}

	get isResolved(): boolean {
		return this.#isResolved;
	}

	get value(): T | undefined {
		return this.#value;
	}
}
