export function extract<T>(arr: T[], predicate: (value: T) => boolean): T[] {
    const subset: T[] = []

    let i = 0
    while (i < arr.length) {
        if (predicate(arr[i])) {
            subset.push(arr.splice(i, 1)[0])
        } else {
            i++
        }
    }

    return subset
}
