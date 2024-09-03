import { lstatSync } from 'fs'
import { sep } from 'path'
import { glob } from 'glob'

export async function expandFilePatterns(patterns: string[]): Promise<string[]> {
    return patterns.flatMap(pattern => {
        if (pattern.includes('*')) {
            return glob.sync(pattern, { nodir: true })
        }

        if (!isDir(pattern)) {
            return [pattern]
        }

        return []
    })
}

export async function expandDirectoryPatterns(patterns: string[]): Promise<string[]> {
    return patterns.flatMap(pattern => {
        if (pattern.includes('*')) {
            return glob
                .sync(pattern, { withFileTypes: true })
                .filter(entry => entry.isDirectory())
                .map(r => r.relativePosix() + sep)
        }

        if (isDir(pattern)) {
            return [pattern]
        }

        return []
    })
}

// Expand the given path prefixes to all _immediate_ descendants that match the prefix.
// This may include both files and directories. Directories will have a trailing slash.
// This assumes that none of the given prefixes already contain wildcards. If so, they
// should be expanded independently.
export async function expandPrefixes(prefixes: string[]): Promise<string[]> {
    return prefixes.flatMap(prefix =>
        glob
            .sync(prefix + '*')
            // Add a trailing slash to directories
            .map(path => `${path}${isDir(path) ? sep : ''}`)
            // Do not complete directories to themselves
            .filter(path => !(path.endsWith(sep) && path === prefix)),
    )
}

function isDir(path: string): boolean {
    try {
        const stat = lstatSync(path)
        return stat.isDirectory()
    } catch (error: any) {
        return false
    }
}
