import deepmerge from 'deepmerge'

export function merge(result: any, extra: any): any {
    return Array.isArray(extra) ? mergeArrays(result, extra) : mergeObjects(result, extra)
}

function mergeArrays(result: any, included: any[]): any {
    if (Object.keys(result).length === 0) {
        return included
    }

    if (Array.isArray(result)) {
        return result.concat(included)
    }

    throw new Error('mixed')
}

function mergeObjects(result: any, included: any): any {
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
