import { lstatSync } from 'fs'
import { sep } from 'path'
import { glob } from 'glob'

export function expandFilePatterns(patterns: string[]): string[] {
    return patterns.flatMap(pattern => (pattern.includes('*') ? glob.sync(pattern, { nodir: true }) : [pattern]))
}

export function expandDirectoryPatterns(patterns: string[]): string[] {
    return patterns.flatMap(pattern =>
        pattern.includes('*')
            ? glob
                  .sync(pattern, { withFileTypes: true })
                  .filter(entry => entry.isDirectory())
                  .map(r => r.relativePosix() + sep)
            : [pattern],
    )
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
    } catch (e) {
        return false
    }
}
