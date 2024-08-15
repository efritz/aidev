export function invertPromise<T = never>(): {
    promise: Promise<T>
    resolve: (value: T) => void
    reject: (reason?: any) => void
} {
    let _resolve: (value: T) => void
    let _reject: (reason?: any) => void

    const promise = new Promise<T>((resolve, reject) => {
        _resolve = resolve
        _reject = reject
    })

    return { promise, resolve: _resolve!, reject: _reject! }
}
