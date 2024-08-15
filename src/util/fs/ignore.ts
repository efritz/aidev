import { existsSync, readFileSync } from 'fs'
import { dirname, sep } from 'path'
import { gitignoreToMinimatch } from '@humanwhocodes/gitignore-to-minimatch'
import chalk from 'chalk'
import { minimatch } from 'minimatch'

export function filterIgnoredPaths(paths: string[]): string[] {
    const patternsByPath: Record<string, string[]> = {}
    const filteredPaths = paths.filter(path => {
        const patterns = matchingPatterns(path)
        if (patterns.length === 0) {
            return true
        }

        patternsByPath[path] = patterns
        return false
    })

    for (const { path, pattern, count } of collectMinimalPaths(patternsByPath)) {
        console.log(
            chalk.yellow(
                `${chalk.dim('ℹ')} Path ${path} ${count > 1 ? `(${count} occurrences) ` : ''}ignored by ${pattern}.`,
            ),
        )
    }

    return filteredPaths
}

function collectMinimalPaths(
    ignoredPathsByPattern: Record<string, string[]>,
): { path: string; pattern: string; count: number }[] {
    const groups: Record<string, string> = {}
    for (const [path, patterns] of Object.entries(ignoredPathsByPattern)) {
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

function matchingPatterns(path: string): string[] {
    return getIgnoredPatterns().filter(pattern => matchPattern(path, pattern))
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

function matchPattern(path: string, pattern: string): boolean {
    return minimatch(path, pattern, { dot: true, matchBase: true })
}

const ignoreFilePath = 'aidev.ignore'
let ignoredPatterns: string[] | undefined = undefined

export function getIgnoredPatterns(): string[] {
    if (ignoredPatterns === undefined) {
        ignoredPatterns = existsSync(ignoreFilePath)
            ? readFileSync(ignoreFilePath, 'utf-8')
                  .split('\n')
                  .map(line => gitignoreToMinimatch(line.trim()))
            : []
    }

    return ignoredPatterns
}
