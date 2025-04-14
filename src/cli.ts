import EventEmitter from 'events'
import readline, { CompleterResult } from 'readline'
import { program } from 'commander'
import { EventSource } from 'eventsource'
import { completer } from './chat/completer'
import { ChatContext } from './chat/context'
import { handler } from './chat/handler'
import { loadHistory } from './chat/history'
import { createContextState } from './context/state'
import { createClient, registerContextListeners } from './mcp/client/client'
import { registerTools } from './mcp/client/tools/tools'
import { ChatProviders, initChatProviders } from './providers/chat_providers'
import { EmbeddingsProviders, initEmbeddingsProviders } from './providers/embeddings_providers'
import { getPreferences, Preferences } from './providers/preferences'
import { getRules } from './rules/loader'
import { Rule } from './rules/types'
import { buildSystemPrompt } from './system'
import { createInterruptHandler, InterruptHandlerOptions } from './util/interrupts/interrupts'
import { createPrompter } from './util/prompter/prompter'
import { createLimiter } from './util/ratelimits/limiter'
import { createUsageTracker, UsageTracker } from './util/usage/tracker'

async function main() {
    // Make EventSource available globally for the MCP SSE transport
    ;(global as any).EventSource = EventSource

    const preferences = await getPreferences()
    const rules = await getRules()

    const limiter = createLimiter()
    const tracker = createUsageTracker()
    const providers = await initChatProviders(preferences, limiter, tracker)
    const embeddingsClients = await initEmbeddingsProviders(preferences, limiter, tracker)

    program
        .name('ai')
        .description('Personalized AI in the terminal.')
        .showHelpAfterError(true)
        .allowExcessArguments(false)
        .storeOptionsAsProperties()

    const historyFlags = '-h, --history <string>'
    const historyDescription = 'File to load chat history from.'

    const portFlags = '-p, --port <number>'
    const portDescription = 'Port number of the vscode extension server providing editor information.'

    const cwdFlags = '--cwd <string>'
    const cwdDescription = 'Working directory for the AI assistant.'

    program
        .option(historyFlags, historyDescription)
        .option(portFlags, portDescription)
        .option(cwdFlags, cwdDescription)
        .action(options => {
            if (options.cwd) {
                process.chdir(options.cwd)
            }
            chat(preferences, rules, providers, embeddingsClients, tracker, options.history, options.port)
        })

    program.parse(process.argv)
}

async function chat(
    preferences: Preferences,
    rules: Rule[],
    providers: ChatProviders,
    embeddingsClients: EmbeddingsProviders,
    tracker: UsageTracker,
    historyFilename?: string,
    port?: number,
) {
    if (!process.stdin.setRawMode) {
        throw new Error('chat command is not supported in this environment.')
    }

    const contextStateManager = await createContextState()
    const system = await buildSystemPrompt(preferences)

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
        const interruptInputOptions = rootInterruptHandlerOptions(rl)
        const prompter = createPrompter(rl, interruptHandler)

        const provider = await providers.createProvider({
            contextState: contextStateManager,
            modelName: preferences.defaultModel,
            system,
        })

        context = {
            preferences,
            rules,
            providers,
            embeddingsClients,
            tracker,
            interruptHandler,
            prompter,
            provider,
            events: new EventEmitter(),
            contextStateManager,
        }

        await registerContextListeners(context, client)

        if (historyFilename) {
            await loadHistory(context, historyFilename)
        }

        const modelName = `${context.provider.modelName} (${context.provider.providerName})`
        console.log(`${historyFilename ? 'Resuming' : 'Beginning'} session with ${modelName}...\n`)

        await interruptHandler.withInterruptHandler(() => handler(context), interruptInputOptions)
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

main()
