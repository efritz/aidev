import { homedir } from 'os'
import { sep } from 'path'
import { CompleterResult } from 'readline'
import { expandDirectoryPatterns, expandFilePatterns, expandPrefixes } from './glob'

export function completeFilePaths(args: string): Promise<CompleterResult> {
    return completePathPatterns(args, expandFilePatterns)
}

export function completeDirectoryPaths(args: string): Promise<CompleterResult> {
    return completePathPatterns(args, expandDirectoryPatterns)
}

async function completePathPatterns(
    args: string,
    expandPatterns: (patterns: string[]) => Promise<string[]>,
): Promise<CompleterResult> {
    const last = args.split(' ').pop()!
    const prefix = canonicalizePathPrefix(last)

    if (prefix.includes('*')) {
        const entries = expandPatterns([prefix])
        if (entries.length === 0) {
            return [[], last]
        }

        // If there are any matches, return a SINGLE result as a string with a trailing space.
        // This will replace the entry with the expanded paths, rather than simply suggesting
        // all of them for individual selection.
        return [[entries.join(' ') + ' '], last]
    }

    return [await expandPrefixes([prefix]), last]
}

function canonicalizePathPrefix(prefix: string): string {
    // Support home directory
    if (prefix.startsWith('~')) {
        prefix = homedir() + prefix.slice(1)
    }

    // Canonicalize relative paths
    if (!prefix.startsWith(`${sep}`) && !prefix.startsWith(`.${sep}`) && !prefix.startsWith(`..${sep}`)) {
        prefix = `.${sep}${prefix}`
    }

    return prefix
}
