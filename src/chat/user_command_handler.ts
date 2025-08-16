import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { ChatContext } from './context'
import { parseArguments, processTemplate } from './template'
import { UserCommand } from './user_commands'

export function createUserCommandHandler(
    commandName: string,
    userCommand: UserCommand,
): (context: ChatContext, args: string) => Promise<void> {
    return async (context: ChatContext, args: string) => {
        const parsedArgs = parseArguments(args)
        const expectedArgCount = userCommand.args.length

        // Validate argument count
        if (parsedArgs.length !== expectedArgCount) {
            const argNames = userCommand.args.map(arg => arg.name).join(', ')
            console.log(
                chalk.red.bold(
                    `Command :${commandName} expects ${expectedArgCount} argument${
                        expectedArgCount === 1 ? '' : 's'
                    } (${argNames}), got ${parsedArgs.length}`,
                ),
            )
            console.log()
            return
        }

        // Map arguments to template placeholders
        const argMap: Record<string, string> = {}
        for (let i = 0; i < userCommand.args.length; i++) {
            argMap[userCommand.args[i].name] = parsedArgs[i]
        }

        // Process template and submit as user message
        const processedMessage = processTemplate(userCommand.template, argMap)

        // Submit the processed message back to the chat handler
        // This allows for chaining meta-commands
        const { handle } = await import('./handler')
        await handle(context, processedMessage)
    }
}

export function createUserCommandCompleter(
    userCommand: UserCommand,
): (context: ChatContext, args: string) => Promise<CompleterResult> {
    return async (_context: ChatContext, args: string) => {
        const parsedArgs = parseArguments(args)
        const currentArgIndex = parsedArgs.length

        // If we haven't provided all arguments yet, show the next expected argument name
        if (currentArgIndex < userCommand.args.length) {
            const nextArg = userCommand.args[currentArgIndex]
            const hint = `<${nextArg.name}>`
            return [[hint], args]
        }

        // All arguments provided, no completion
        return [[], args]
    }
}
