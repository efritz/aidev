import { homedir } from 'os'
import { sep } from 'path'
import { CompleterResult } from 'readline'
import { expandDirectoryPatterns, expandFileAndDirectoryPatterns, expandFilePatterns, expandPrefixes } from './glob'

export function parseArgsWithEscapedSpaces(args: string): string[] {
    let current = ''
    let escaped = false
    let quoteChar: '"' | "'" | null = null

    const result: string[] = []
    for (const char of args) {
        if (escaped && char != ' ') {
            // Validate escape sequences
            throw new Error(`Invalid escape sequence: "\\${char}"`)
        }

        if (char === '\\') {
            // Escape next character
            escaped = true
        } else if (char === quoteChar) {
            // End of quoted string, save current buffer
            result.push(current)
            current = ''
            quoteChar = null
        } else if (char === '"' || char === "'") {
            // Start of quoted string
            quoteChar = char
        } else if (char === ' ' && !quoteChar && !escaped) {
            // End of unquoted string, save current buffer
            result.push(current)
            current = ''
        } else {
            // Text or escaped/quoted character, add to current buffer
            escaped = false
            current += char
        }
    }

    if (escaped) {
        // If the last character was an escape, implicit complete a space
        current += ' '
    }

    if (current) {
        // If there is a non-empty current string, add it to the result
        result.push(current)
    }

    return result.filter(p => p.trim() !== '')
}

export function completeFilePaths(args: string): Promise<CompleterResult> {
    return completePathPatterns(args, expandFilePatterns)
}

export function completeDirectoryPaths(args: string): Promise<CompleterResult> {
    return completePathPatterns(args, expandDirectoryPatterns)
}

export function completeFileAndDirectoryPaths(args: string): Promise<CompleterResult> {
    return completePathPatterns(args, expandFileAndDirectoryPatterns)
}

async function completePathPatterns(
    args: string,
    expandPatterns: (patterns: string[]) => Promise<string[]>,
): Promise<CompleterResult> {
    const last = args.split(' ').pop()!
    const prefix = canonicalizePathPrefix(last)

    if (prefix.includes('*')) {
        const entries = await expandPatterns([prefix])
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
