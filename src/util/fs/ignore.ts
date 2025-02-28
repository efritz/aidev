import path, { dirname, sep } from 'path'
import { gitignoreToMinimatch } from '@humanwhocodes/gitignore-to-minimatch'
import chalk from 'chalk'
import { minimatch } from 'minimatch'
import { safeReadFile } from './safe'

export async function filterIgnoredPaths(paths: string[], silent = false): Promise<string[]> {
    const matchPatterns = await createIgnoredPathMatcher()
    const pathAndMatchingIgnorePatterns = new Map(paths.map(path => [path, matchPatterns(path)]))

    if (!silent) {
        for (const { path, pattern, count } of collectMinimalPaths(
            // Create path -> patterns map for paths with non-empty patterns
            filterMap(pathAndMatchingIgnorePatterns, patterns => patterns.length > 0),
        )) {
            console.log(
                chalk.yellow(
                    `${chalk.dim('ℹ')} Path ${path} ${count > 1 ? `(${count} occurrences) ` : ''}ignored by ${pattern}.`,
                ),
            )
        }
    }

    // Extract path from pairs with no patterns
    return [...filterMap(pathAndMatchingIgnorePatterns, patterns => patterns.length === 0).keys()]
}

export async function createIgnoredPathFilterer(): Promise<(path: string) => boolean> {
    const matchPatterns = await createIgnoredPathMatcher()
    return path => matchPatterns(path).length === 0
}

const ignorePatternPaths = ['.gitignore', path.join('.aidev', 'ignore')]

async function createIgnoredPathMatcher(): Promise<(path: string) => string[]> {
    const patterns = (await Promise.all(ignorePatternPaths.map(safeReadLines))).flat().map(gitignoreToMinimatch)
    return path => matchPatterns(path, patterns)
}

function matchPatterns(path: string, patterns: string[]): string[] {
    // Match all patterns. For negated patterns, strip off the leading bang symbol
    // and match the rest of the pattern against this path. We'll separate matches
    // for negated patterns below.
    const matchingPatterns = patterns.filter(pattern =>
        matchPattern(path, pattern.startsWith('!') ? pattern.slice(1) : pattern),
    )

    // To cover negated patterns, we'll return all matching patterns AFTER the last
    // matching negated pattern. This has the effect of each negated pattern removing
    // all the matching patterns that came before it.
    for (let i = matchingPatterns.length - 1; i >= 0; i--) {
        if (matchingPatterns[i].startsWith('!')) {
            return matchingPatterns.slice(i + 1)
        }
    }

    // If we didn't have any negated patterns, return any ignore patterns that did match.
    return matchingPatterns
}

function matchPattern(path: string, pattern: string): boolean {
    return minimatch(path, pattern, { dot: true, matchBase: true })
}

//
//

function collectMinimalPaths(
    ignoredPathsByPattern: Map<string, string[]>,
): { path: string; pattern: string; count: number }[] {
    const groups: Record<string, string> = {}
    for (const [path, patterns] of ignoredPathsByPattern.entries()) {
        const candidates = patterns
            .map(pattern => [minimizeMatch(path, pattern), pattern])
            .sort((a, b) => a[0].length - b[0].length || a[1].localeCompare(b[1]))

        const [minimal, pattern] = candidates[0]
        groups[minimal] = pattern
    }

    const counts: Record<string, { path: string; pattern: string; count: number }> = {}
    for (const [path, pattern] of Object.entries(groups)) {
        counts[path] = counts[path] || { path, pattern, count: 0 }
        counts[path].count++
    }

    return Object.values(counts).sort((a, b) => a.path.localeCompare(b.path))
}

function minimizeMatch(path: string, pattern: string): string {
    let current = path
    let parent = dirname(current)
    while (matchPattern(parent + sep, pattern)) {
        current = parent
        parent = dirname(current)
    }

    return current.endsWith(sep) ? current.slice(0, -1) : current
}

//
//

async function safeReadLines(path: string): Promise<string[]> {
    return (await safeReadFile(path))
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '')
}

function filterMap<K, V>(map: Map<K, V>, predicate: (value: V, key: K) => boolean): Map<K, V> {
    return new Map([...map.entries()].filter(([key, value]) => predicate(value, key)))
}
