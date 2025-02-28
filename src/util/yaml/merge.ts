import deepmerge from 'deepmerge'

export function merge(result: any, included: any): any {
    if (Object.keys(result).length === 0) {
        return included
    }

    if (typeof included === 'string') {
        throw new Error('Cannot merge string into object')
    }

    if (Array.isArray(included)) {
        if (!Array.isArray(result)) {
            throw new Error('Cannot merge array into object')
        }

        return result.concat(included)
    }

    return deepmerge(result, included, {
        arrayMerge: (target: any[], source: any[], options: any) => {
            const destination = target.slice()

            source.forEach((item, index) => {
                if (typeof destination[index] === 'undefined') {
                    destination[index] = options.cloneUnlessOtherwiseSpecified(item, options)
                } else if (options.isMergeableObject(item)) {
                    destination[index] = deepmerge(target[index], item, options)
                } else if (target.indexOf(item) === -1) {
                    destination.push(item)
                }
            })

            return destination
        },
    })
}
