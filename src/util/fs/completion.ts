import { homedir } from 'os'
import { sep } from 'path'
import { CompleterResult } from 'readline'
import { expandDirectoryPatterns, expandFileAndDirectoryPatterns, expandFilePatterns, expandPrefixes } from './glob'

export function parseArgsWithEscapedSpaces(args: string, raw = false): string[] {
    let current = ''
    let escaped = false
    let quoteChar: '"' | "'" | null = null

    const result: string[] = []
    for (const char of args) {
        if (escaped && char !== ' ') {
            // The only valid escape is a space
            throw new Error(`Invalid escape sequence: "\\${char}"`)
        }

        if ((char === '"' || char === "'") && !quoteChar && current) {
            // Quoted strings must be at the start of the argument
            throw new Error(`Unexpected quote character: "${char}"`)
        }

        if (char === ' ' && !quoteChar && !escaped) {
            // End of unquoted string, save current buffer
            result.push(current)
            current = ''
            continue
        }

        if (char === '\\') {
            if (raw) {
                // Preserve control characters in raw mode
                current += char
            }

            // Escape next character
            escaped = true
        } else if (char === quoteChar) {
            if (raw) {
                // Preserve control characters in raw mode
                current += char
            }

            // End of quoted string, save current buffer
            result.push(current)
            current = ''
            quoteChar = null
        } else if ((char === '"' || char === "'") && !quoteChar) {
            if (raw) {
                // Preserve control characters in raw mode
                current += char
            }

            // Start of quoted string
            quoteChar = char
        } else {
            // Text or escaped/quoted character, add to current buffer
            escaped = false
            current += char
        }
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
    const parsedArgs = parseArgsWithEscapedSpaces(args, true)
    const last = parsedArgs[parsedArgs.length - 1] || ''
    const prefix = canonicalizePathPrefix(last)

    if (prefix.includes('*')) {
        const entries = await expandPatterns([prefix])
        if (entries.length === 0) {
            return [[], last]
        }

        // If there are any matches, return a SINGLE result as a string with a trailing space.
        // This will replace the entry with the expanded paths, rather than simply suggesting
        // all of them for individual selection.
        const quotedEntries = entries.map(entry => entry.replaceAll(/([^\\]) /g, '$1\\ '))
        return [[quotedEntries.join(' ') + ' '], last]
    }

    const expandedPrefixes = await expandPrefixes([prefix])
    const quotedPrefixes = expandedPrefixes.map(entry => entry.replaceAll(/([^\\]) /g, '$1\\ '))
    return [quotedPrefixes, last]
}

function canonicalizePathPrefix(prefix: string): string {
    // Strip quotes (might be incomplete)
    if (prefix.startsWith('"') || prefix.startsWith("'")) {
        if (prefix.endsWith(prefix[0])) {
            prefix = prefix.slice(1, -1)
        } else {
            prefix = prefix.slice(1)
        }
    }

    // Unescape spaces
    prefix = prefix.replaceAll(/\\ /g, ' ')

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
