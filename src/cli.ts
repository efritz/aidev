import { readFileSync } from 'fs'
import readline from 'readline'
import { program } from 'commander'
import { completer } from './chat/completer'
import { ChatContext } from './chat/context'
import { createEditorEventSource, registerEditorListeners } from './chat/editor'
import { handler } from './chat/handler'
import { loadHistory } from './chat/history'
import { ContextState, createContextState } from './context/state'
import { Provider } from './providers/provider'
import { createProvider, modelNames } from './providers/providers'
import { createInterruptHandler, InterruptHandlerOptions } from './util/interrupts/interrupts'
import { createPrompter } from './util/prompter/prompter'

async function main() {
    program
        .name('ai')
        .description('Personalized AI in the terminal.')
        .showHelpAfterError(true)
        .allowExcessArguments(false)
        .storeOptionsAsProperties()

    const modelFlags = '-m, --model <string>'
    const modelDescription = `Model to use. Valid options are ${modelNames.join(', ')}.`
    const modelDefault = 'sonnet'

    const historyFlags = '-h, --history <string>'
    const historyDescription = 'File to load chat history from.'

    const portFlags = '-p, --port <number>'
    const portDescription = 'Port number of the vscode extension server providing editor information.'

    program
        .option(modelFlags, modelDescription, modelDefault)
        .option(historyFlags, historyDescription)
        .option(portFlags, portDescription)
        .action(options => chat(options.model, options.history, options.port))

    program.parse(process.argv)
}

const basicSystemPrompt = `
You are an expert software developer engaged in pair programming with the user.
Your role is to provide assistance, guidance, and code solutions based on the user's queries and the existing project context.
Always use best practices when coding. Respect and use existing conventions, libraries, etc that are already present in the code base.

# Project context

The conversation will begin with a dump containing relevant project files and directories.
The contents of the dump will ALWAYS include the most recent version of files and directories as they exist on-disk.
The set of files included in this dump may change as the conversation progresses:

- The user may include additional files and directories into the context.
- You may request for specific files or directories to be included in the context with the read_files and read_directories tools.

# Working together

When responding to the user's query, follow these steps:

1. Analyze the user's query.
2. Determine the type of assistance required (e.g., code writing, debugging, optimization, explanation).
3. Remember that you are pairing - if you need more information or clarification, ask the user for additional details.
4. Review the existing project to understand the context and existing code structure.
    a. First use the project context dump to understand the current state of the project.
    b. If necessary, use the read_files and read_directories tools to access additional files and directories.
5. If you need to think through your approach or break down the problem, use <thought> tags before your final response.

Remember:
- Always use best practices when coding.
- Respect and use existing conventions, libraries, etc. that are already present in the code base.
- Strive for accuracy and helpfulness in your responses.
- If you're unsure about something, say so and suggest alternatives or further research.
- Respect the scope of your capabilities and don't claim to perform actions outside of your defined functions.
- The user is also an expert software developer, so be direct and concise in your responses.

Begin your assistance by analyzing the user's query and providing an appropriate response.
`

function buildSystemPrompt(): string {
    const parts = [basicSystemPrompt, buildProjectInstructions()]

    return parts
        .map(part => part.trim())
        .filter(part => part !== '')
        .join('\n\n')
}

function buildProjectInstructions(): string {
    try {
        const path = 'aidev.system'
        const instructions = readFileSync(path, 'utf-8')

        return `# Project-specific instructions\n\n${instructions}`
    } catch (error: any) {}

    return ''
}

async function chat(model: string, historyFilename?: string, port?: number) {
    if (!process.stdin.setRawMode) {
        throw new Error('chat command is not supported in this environment.')
    }

    const contextState = createContextState()
    const system = buildSystemPrompt()
    await chatWithProvider(contextState, createProvider(contextState, model, system), model, historyFilename, port)
}

async function chatWithProvider(
    contextState: ContextState,
    provider: Provider,
    model: string,
    historyFilename?: string,
    port?: number,
) {
    let context: ChatContext

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        completer: (line: string) => (context ? completer(context, line) : undefined),
    })

    const editorEventSource = createEditorEventSource(port)

    try {
        const interruptHandler = createInterruptHandler(rl)
        const prompter = createPrompter(rl, interruptHandler)
        const interruptInputOptions = rootInterruptHandlerOptions(rl)

        context = {
            model,
            interruptHandler,
            prompter,
            provider,
            contextState,
        }

        registerEditorListeners(context, editorEventSource)

        await interruptHandler.withInterruptHandler(
            () => chatWithReadline(context, historyFilename),
            interruptInputOptions,
        )
    } finally {
        rl.close()
        editorEventSource?.close()
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

async function chatWithReadline(context: ChatContext, historyFilename?: string) {
    if (historyFilename) {
        loadHistory(context, historyFilename)
    }

    console.log(`${historyFilename ? 'Resuming' : 'Beginning'} session with ${context.model}...\n`)
    await handler(context)
}

await main()
