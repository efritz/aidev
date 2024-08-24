import * as path from 'path'
import { CompleterResult } from 'readline'
import { expandFilePatterns } from '../util/fs/glob'
import { filterIgnoredPaths } from '../util/fs/ignore'
import { commands, completeCommand } from './commands/commands'
import { ChatContext } from './context'

const commandPrefixes = commands.map(({ prefix, expectsArgs }) => prefix + (expectsArgs ? ' ' : ''))

export function completer(context: ChatContext, line: string): CompleterResult {
    if (line === '') {
        // Show all meta commands
        return [commandPrefixes, line]
    }

    // Complete a specific command (with a fully provided prefix)
    const commandResult = completeCommand(context, line)
    if (commandResult) {
        return commandResult
    }

    // Complete all partially provided commands
    const hits = commandPrefixes.filter(completion => completion.startsWith(line))
    if (hits.length > 0) {
        return [hits, line]
    }

    // Complete a @tagged-file at the end of the input
    const taggedFileResult = completeTaggedFile(line)
    if (taggedFileResult) {
        return taggedFileResult
    }

    // No completion suggestions
    return [[], line]
}

export function completeTaggedFile(line: string): CompleterResult | undefined {
    const parts = line.split(' ')
    const suffix = parts[parts.length - 1]

    if (!suffix.startsWith('@')) {
        return undefined
    }

    const searchTerm = suffix.slice(1).toLowerCase()
    const allFiles = filterIgnoredPaths(expandFilePatterns(['./**/*']), true)
    const matchingFiles = allFiles.filter(file => file.toLowerCase().includes(searchTerm))

    if (matchingFiles.length > 0) {
        return [matchingFiles.map(file => '@' + file + (matchingFiles.length === 1 ? ' ' : '')), suffix]
    }

    return undefined
}
