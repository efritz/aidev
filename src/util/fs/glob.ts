import { lstatSync, statSync } from 'fs'
import { sep } from 'path'
import { glob } from 'glob'

export function expandFilePatterns(patterns: string[]): string[] {
    return patterns.flatMap(pattern => {
        if (pattern.includes('*')) {
            return glob.sync(pattern, { nodir: true })
        }

        if (statSync(pattern).isFile()) {
            return [pattern]
        }

        return []
    })
}

export function expandDirectoryPatterns(patterns: string[]): string[] {
    return patterns.flatMap(pattern => {
        if (pattern.includes('*')) {
            return glob
                .sync(pattern, { withFileTypes: true })
                .filter(entry => entry.isDirectory())
                .map(r => r.relativePosix() + sep)
        }

        if (statSync(pattern).isDirectory()) {
            return [pattern]
        }

        return []
    })
}

// Expand the given path prefixes to all _immediate_ descendants that match the prefix.
// This may include both files and directories. Directories will have a trailing slash.
// This assumes that none of the given prefixes already contain wildcards. If so, they
// should be expanded independently.
export function expandPrefixes(prefixes: string[]): string[] {
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
        return lstatSync(path).isDirectory()
    } catch (error: any) {
        return false
    }
}
