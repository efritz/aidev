import { CompleterResult } from 'readline'
import { completeCommand, getCommands } from './commands'
import { ChatContext } from './context'

export type CompleterType = 'meta' | 'choice'

let completerType: CompleterType | undefined = undefined

export function setCompleterType(type: CompleterType) {
    completerType = type
}

export async function completer(context: ChatContext, line: string): Promise<CompleterResult> {
    switch (completerType) {
        case 'meta':
            return metaCompleter(context, line)

        default:
            return [[], line]
    }
}

async function metaCompleter(context: ChatContext, line: string): Promise<CompleterResult> {
    const commands = await getCommands()
    const prefixes = commands
        .filter(({ valid }) => valid?.(context) ?? true)
        .map(({ prefix, expectsArgs }) => prefix + (expectsArgs ? ' ' : ''))

    if (line === '') {
        // Show all meta commands
        return [prefixes, line]
    }

    // Determine which command prefixes match the current line
    const hits = prefixes.filter(completion => completion.startsWith(line))

    if (hits.length <= 1) {
        // Try to complete a specific command (with a fully provided prefix)
        const commandResult = await completeCommand(context, line)
        if (commandResult) {
            return commandResult
        }

        // Suppress unhelpful completion of the exact same line
        if (hits.length === 1 && hits[0] === line) {
            return [[], line]
        }
    }

    // Complete any partially provided commands
    return [hits, line]
}
