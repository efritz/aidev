export async function finalizingPromise<T>(promise: Promise<T>, onDone: () => void): Promise<T> {
    const result = await promise
    onDone()
    return result
}
