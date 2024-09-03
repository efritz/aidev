import { readFile } from 'fs/promises'
import { dirname, sep } from 'path'
import { gitignoreToMinimatch } from '@humanwhocodes/gitignore-to-minimatch'
import chalk from 'chalk'
import { minimatch } from 'minimatch'

export async function filterIgnoredPaths(paths: string[], silent = false): Promise<string[]> {
    const pairs = await Promise.all(paths.map(async path => [path, await matchingPatterns(path)] as [string, string[]]))
    const patternsByIgnoredPath = new Map(pairs.filter(([_, patterns]) => patterns.length > 0))
    const nonIgnoredPaths = pairs.filter(([_, patterns]) => patterns.length === 0).map(([path]) => path)

    if (!silent) {
        for (const { path, pattern, count } of collectMinimalPaths(patternsByIgnoredPath)) {
            console.log(
                chalk.yellow(
                    `${chalk.dim('ℹ')} Path ${path} ${count > 1 ? `(${count} occurrences) ` : ''}ignored by ${pattern}.`,
                ),
            )
        }
    }

    return nonIgnoredPaths
}

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

async function matchingPatterns(path: string): Promise<string[]> {
    return (await getIgnoredPatterns()).filter(pattern => matchPattern(path, pattern))
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

export async function getIgnoredPatterns(): Promise<string[]> {
    if (ignoredPatterns === undefined) {
        ignoredPatterns = (await safeReadLines(ignoreFilePath)).map(gitignoreToMinimatch)
    }

    return ignoredPatterns
}

async function safeReadLines(path: string): Promise<string[]> {
    return (await safeReadFile(path))
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '')
}

async function safeReadFile(path: string): Promise<string> {
    try {
        return await readFile(path, 'utf-8')
    } catch (error: any) {
        return ''
    }
}
