import { lstat } from 'fs/promises'
import { sep } from 'path'
import { glob } from 'glob'

export async function expandFilePatterns(patterns: string[]): Promise<string[]> {
    const expanded: string[] = []
    for (const pattern of patterns) {
        if (pattern.includes('*')) {
            expanded.push(...(await glob.glob(pattern, { nodir: true })))
        } else if (!(await isDir(pattern))) {
            expanded.push(pattern)
        }
    }

    return expanded
}

export async function expandDirectoryPatterns(patterns: string[]): Promise<string[]> {
    const expanded: string[] = []
    for (const pattern of patterns) {
        if (pattern.includes('*')) {
            expanded.push(
                ...(await glob.glob(pattern, { withFileTypes: true }))
                    .filter(entry => entry.isDirectory())
                    .map(r => r.relativePosix() + sep),
            )
        } else if (await isDir(pattern)) {
            expanded.push(pattern)
        }
    }

    return expanded
}

// Expand the given path prefixes to all _immediate_ descendants that match the prefix.
// This may include both files and directories. Directories will have a trailing slash.
// This assumes that none of the given prefixes already contain wildcards. If so, they
// should be expanded independently.
export async function expandPrefixes(prefixes: string[]): Promise<string[]> {
    const expanded: string[] = []
    for (const prefix of prefixes) {
        for (let path of await glob.glob(prefix + '*')) {
            if (await isDir(path)) {
                // Add a trailing slash to directories
                path += sep

                if (path === prefix) {
                    // Do not complete directories to themselves
                    continue
                }
            }

            expanded.push(path)
        }
    }

    return expanded
}

async function isDir(path: string): Promise<boolean> {
    try {
        return (await lstat(path)).isDirectory()
    } catch (error: any) {
        return false
    }
}
