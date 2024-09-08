import { CompleterResult } from 'readline'
import { commands, completeCommand } from './commands/commands'
import { canReprompt, ChatContext } from './context'

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

const commandPrefixes = commands.map(({ prefix, expectsArgs }) => prefix + (expectsArgs ? ' ' : ''))

async function metaCompleter(context: ChatContext, line: string): Promise<CompleterResult> {
    const prefixes = [...commandPrefixes]
    if (canReprompt(context)) {
        prefixes.push(':continue')
    }

    if (line === '') {
        // Show all meta commands
        return [prefixes, line]
    }

    // Complete a specific command (with a fully provided prefix)
    const commandResult = await completeCommand(context, line)
    if (commandResult) {
        return commandResult
    }

    // Complete all partially provided commands
    const hits = prefixes.filter(completion => completion.startsWith(line))
    if (hits.length > 0) {
        return [hits, line]
    }

    // No completion suggestions
    return [[], line]
}
