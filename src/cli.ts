import { readFile } from 'fs/promises'
import readline, { CompleterResult } from 'readline'
import { program } from 'commander'
import EventSource from 'eventsource'
import { completer } from './chat/completer'
import { ChatContext } from './chat/context'
import { handler } from './chat/handler'
import { loadHistory } from './chat/history'
import { ContextStateManager, createContextState } from './context/state'
import { createClient, registerContextListeners } from './mcp/client/client'
import { registerTools } from './mcp/client/tools/tools'
import { Provider } from './providers/provider'
import { createProvider, modelNames } from './providers/providers'
import { createInterruptHandler, InterruptHandlerOptions } from './util/interrupts/interrupts'
import { createPrompter } from './util/prompter/prompter'

async function main() {
    // Make EventSource available globally for the MCP SSE transport
    ;(global as any).EventSource = EventSource

    program
        .name('ai')
        .description('Personalized AI in the terminal.')
        .showHelpAfterError(true)
        .allowExcessArguments(false)
        .storeOptionsAsProperties()

    const modelFlags = '-m, --model <string>'
    const modelDescription = `Model to use. Valid options are ${modelNames.join(', ')}.`

    const historyFlags = '-h, --history <string>'
    const historyDescription = 'File to load chat history from.'

    const portFlags = '-p, --port <number>'
    const portDescription = 'Port number of the vscode extension server providing editor information.'

    program
        .option(modelFlags, modelDescription)
        .option(historyFlags, historyDescription)
        .option(portFlags, portDescription)
        .action(options => chat(options.model, options.history, options.port))

    program.parse(process.argv)
}

const systemPromptTemplate = `
You are an expert software developer engaged in pair programming with the user.
Your role is to provide assistance, guidance, and code solutions based on the user's queries and the existing project context.
Always use best practices when coding. Respect and use existing conventions, libraries, etc that are already present in the code base.

# Project context

The conversation may include the contents of files and directories from the project.
The user may explicitly add/remove files or directories into/from the conversation.
The contents of files and directories will be included in the conversation only once, directly after their most recent reference.
The contents of files and directories will be supplied by the user in a message starting with "Project context has been updated.".
The contents of files and directories will always reflect the current state on-disk (including changes made outside of the conversation).
Always base your understanding and responses on the most recent project context update for any given file.

# Working together

When responding to the user's query, follow these steps:

1. Analyze the user's query.
2. Determine the type of assistance required (e.g., code writing, debugging, optimization, explanation).
3. Remember that you are pairing - if you need more information or clarification, ask the user for additional details.
4. Review the existing project to understand the context and existing code structure.
    a. First, try to use the files and directory contents included in the context to understand the current state of the project.
    b. To read files or directories absent from the context, use the read_files and read_directories tools.
5. If you need to think through your approach or break down the problem, use <thought> tags before your final response.

Remember:
- Always use best practices when coding.
- Respect and use existing conventions, libraries, etc. that are already present in the code base.
- Strive for accuracy and helpfulness in your responses.
- If you're unsure about something, say so and suggest alternatives or further research.
- Respect the scope of your capabilities and don't claim to perform actions outside of your defined functions.
- The user is also an expert software developer, so be direct and concise in your responses.

Begin your assistance by analyzing the user's query and providing an appropriate response.

The current directory is {{cwd}}}.

{{custom instructions}}
`

async function buildSystemPrompt(): Promise<string> {
    return systemPromptTemplate
        .replace('{{cwd}}', process.cwd())
        .replace('{{custom instructions}}', await buildProjectInstructions())
}

async function buildProjectInstructions(): Promise<string> {
    try {
        const path = 'aidev.system'
        const instructions = await readFile(path, 'utf-8')

        return `# Project-specific instructions\n\n${instructions}`
    } catch (error: any) {}

    return ''
}

async function chat(model: string, historyFilename?: string, port?: number) {
    if (!process.stdin.setRawMode) {
        throw new Error('chat command is not supported in this environment.')
    }

    const contextStateManager = createContextState()
    const system = await buildSystemPrompt()
    const provider = await createProvider(contextStateManager, model || 'sonnet', system)
    await chatWithProvider(contextStateManager, provider, !model, historyFilename, port)
}

async function chatWithProvider(
    contextStateManager: ContextStateManager,
    provider: Provider,
    usingDefaultModel: boolean,
    historyFilename?: string,
    port?: number,
) {
    let context: ChatContext

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        completer: (line: string, callback: (err?: null | Error, result?: CompleterResult) => void): void => {
            if (context) {
                completer(context, line).then(result => callback(undefined, result))
            }
        },
    })

    const client = await createClient(port)
    await registerTools(client)

    try {
        const interruptHandler = createInterruptHandler(rl)
        const prompter = createPrompter(rl, interruptHandler)
        const interruptInputOptions = rootInterruptHandlerOptions(rl)

        context = {
            interruptHandler,
            prompter,
            provider,
            contextStateManager,
        }

        await registerContextListeners(context, client)

        await interruptHandler.withInterruptHandler(
            () => chatWithReadline(context, usingDefaultModel, historyFilename),
            interruptInputOptions,
        )
    } finally {
        rl.close()
        contextStateManager.dispose()
        client?.close()
    }
}

function rootInterruptHandlerOptions(rl: readline.Interface): InterruptHandlerOptions {
    let last: Date
    const threshold = 1000

    const onAbort = () => {
        const now = new Date()
        if (last && now.getTime() - last.getTime() <= threshold) {
            console.log()
            console.log('Goodbye!\n')
            rl.close()
            process.exit(0)
        }

        rl.pause()
        process.stdout.write('^C')
        rl.resume()
        last = now
    }

    return {
        permanent: true,
        throwOnCancel: false,
        onAbort,
    }
}

async function chatWithReadline(context: ChatContext, usingDefaultModel: boolean, historyFilename?: string) {
    if (historyFilename) {
        await loadHistory(context, usingDefaultModel, historyFilename)
    }

    console.log(`${historyFilename ? 'Resuming' : 'Beginning'} session with ${context.provider.name}...\n`)
    await handler(context)
}

main()
