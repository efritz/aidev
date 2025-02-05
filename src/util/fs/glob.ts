import { sep } from 'path'
import { glob } from 'glob'
import { isDir } from './safe'

export async function expandFilePatterns(patterns: string[]): Promise<string[]> {
    return (
        await Promise.all(
            patterns.map(async pattern => {
                if (!pattern.includes('*')) {
                    return (await isDir(pattern)) ? [] : [pattern]
                }

                return glob.glob(pattern, { nodir: true })
            }),
        )
    ).flat()
}

export async function expandDirectoryPatterns(patterns: string[]): Promise<string[]> {
    return (
        await Promise.all(
            patterns.map(async pattern => {
                if (!pattern.includes('*')) {
                    return (await isDir(pattern)) ? [pattern] : []
                }

                return (await glob.glob(pattern, { withFileTypes: true }))
                    .filter(entry => entry.isDirectory())
                    .map(r => r.relativePosix())
                    .map(path => (path || '.') + sep)
            }),
        )
    ).flat()
}

export async function expandFileAndDirectoryPatterns(patterns: string[]): Promise<string[]> {
    return (await Promise.all([expandFilePatterns(patterns), expandDirectoryPatterns(patterns)])).flat()
}

// Expand the given path prefixes to all _immediate_ descendants that match the prefix.
// This may include both files and directories. Directories will have a trailing slash.
// This assumes that none of the given prefixes already contain wildcards. If so, they
// should be expanded independently.
export async function expandPrefixes(prefixes: string[]): Promise<string[]> {
    const paths = (await Promise.all(prefixes.map(async prefix => glob.glob(prefix + '*')))).flat()
    const categorizedPaths = await Promise.all(paths.map(async path => ({ path, isDir: await isDir(path) })))

    return (
        categorizedPaths
            // Add a trailing slash to directories
            .map(({ path, isDir }) => (isDir ? path + sep : path))
            // Do not complete directories to themselves
            .filter(path => !(path.endsWith(sep) && prefixes.includes(path)))
    )
}
