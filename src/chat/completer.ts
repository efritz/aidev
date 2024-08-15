import { CompleterResult } from 'readline'
import { commands, completeCommand } from './commands/commands'
import { ChatContext } from './context'

const commandPrefixes = commands.map(({ prefix, expectsArgs }) => prefix + (expectsArgs ? ' ' : ''))

export function completer(context: ChatContext, line: string): CompleterResult {
    const result = completeCommand(context, line)
    if (result) {
        return result
    }

    // Complete any meta command; if the line is empty show all meta commands.
    const hits = commandPrefixes.filter(completion => completion.startsWith(line))
    return [line === '' ? commandPrefixes : hits, line]
}
