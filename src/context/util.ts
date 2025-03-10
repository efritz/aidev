export function replaceMap<K, V>(target: Map<K, V>, source: Map<K, V>) {
    target.clear()
    source.forEach((value, key) => target.set(key, value))
}
