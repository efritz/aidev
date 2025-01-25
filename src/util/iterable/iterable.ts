export function toIterable<T>(factory: () => Promise<T>): AsyncIterable<T> {
    async function* createIterable() {
        yield await factory()
    }

    return createIterable()
}
