import { exec, spawn } from 'child_process'
import EventEmitter from 'events'
import { dirname } from 'node:path'
import { Transform, TransformCallback } from 'node:stream'
import readline, { CompleterResult } from 'readline'
import { program } from 'commander'
import { EventSource } from 'eventsource'
import { completer } from './chat/completer'
import { ChatContext } from './chat/context'
import { handle, handler } from './chat/handler'
import { loadHistory } from './chat/history'
import { createContextState } from './context/state'
import { createClient, registerContextListeners } from './mcp/client/client'
import { registerTools } from './mcp/client/tools/tools'
import { ChatProviders, initChatProviders } from './providers/chat_providers'
import { EmbeddingsProviders, initEmbeddingsProviders } from './providers/embeddings_providers'
import { keyDir } from './providers/keys'
import { getPreferences, Preferences, preferencesDir } from './providers/preferences'
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

    const oneShotFlags = '--one-shot <string>'
    const oneShotDescription = 'Run a single prompt and exit after the assistant responds. Intended for automated use.'

    const yoloFlags = '--yolo'
    const yoloDescription =
        'Skip user confirmation for potentially dangerous operations like file writing and shell execution.'

    const dockerFlags = '--docker'
    const dockerDescription = 'Run in a Docker container with the current workspace mounted into it.'

    program
        .option(historyFlags, historyDescription)
        .option(portFlags, portDescription)
        .option(cwdFlags, cwdDescription)
        .option(yoloFlags, yoloDescription)
        .option(oneShotFlags, oneShotDescription)
        .option(dockerFlags, dockerDescription)
        .action(options => {
            if (options.docker) {
                if (!options.oneShot) {
                    throw new Error('The --one-shot option requires a prompt string.')
                }
                if (!options.yolo) {
                    throw new Error('The --yolo option is required when using --docker.')
                }
                if (options.port) {
                    throw new Error('The --port option is not supported when using --docker.')
                }

                runInDocker(options)
            } else {
                if (options.cwd) {
                    process.chdir(options.cwd)
                }

                chat(
                    preferences,
                    rules,
                    providers,
                    embeddingsClients,
                    tracker,
                    options.history,
                    options.port,
                    options.oneShot,
                    options.yolo,
                )
            }
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
    oneShot?: string,
    yolo: boolean = false,
) {
    let context: ChatContext

    if (!process.stdin.setRawMode) {
        throw new Error('chat command is not supported in this environment.')
    }

    readline.emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)
    const filter = new ShiftEnterFilter()
    process.stdin.pipe(filter)

    const rl = readline.createInterface({
        input: filter,
        output: process.stdout,
        terminal: true,
        completer: (line: string, callback: (err?: null | Error, result?: CompleterResult) => void): void => {
            if (context) {
                completer(context, line).then(result => callback(undefined, result))
            }
        },
    })

    filter.on('shiftenter', () => {
        ;(rl as unknown as { _insertString: (s: string) => void })._insertString('\n')
    })

    const client = await createClient(port)
    const system = await buildSystemPrompt(preferences)
    const contextStateManager = await createContextState()
    await registerTools(client)

    try {
        const interruptHandler = createInterruptHandler(rl)
        const interruptInputOptions = rootInterruptHandlerOptions(rl)
        const prompter = createPrompter(
            rl,
            interruptHandler,
            attentionGetter(preferences.attentionCommand ?? defaultAttentionCommand),
        )

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
            yolo,
        }

        await registerContextListeners(context, client)

        if (historyFilename) {
            await loadHistory(context, historyFilename)
        }

        const modelName = `${context.provider.modelName} (${context.provider.providerName})`
        console.log(`${historyFilename ? 'Resuming' : 'Beginning'} session with ${modelName}...\n`)

        await interruptHandler.withInterruptHandler(
            () => (oneShot ? handle(context, oneShot) : handler(context)),
            interruptInputOptions,
        )
    } finally {
        process.stdin.unpipe(filter)
        filter.destroy()
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

const shiftEnter = '\x1b[27;2;13~'
const xtermFocusIn = '\x1b[I'
const xtermFocusOut = '\x1b[O'
const xtermEnableFocusReporting = '\x1b[?1004h'
const xtermDisableFocusReporting = '\x1b[?1004l'
const defaultAttentionCommand = 'afplay /System/Library/Sounds/Submarine.aiff'

export class ShiftEnterFilter extends Transform {
    #buf = ''

    _transform(chunk: any, _enc: BufferEncoding, cb: TransformCallback) {
        this.#buf += chunk.toString('binary')

        while (this.#buf.length) {
            // Full match; swallow and emit signal
            if (this.#buf.startsWith(shiftEnter)) {
                this.emit('shiftenter')
                this.#buf = this.#buf.slice(shiftEnter.length)
                continue
            }

            // Wait for more bytes
            if (shiftEnter.startsWith(this.#buf)) {
                break
            }

            // Pass through
            this.push(this.#buf[0])
            this.#buf = this.#buf.slice(1)
        }
        cb()
    }

    _flush(cb: TransformCallback) {
        if (this.#buf) {
            this.push(this.#buf)
        }

        cb()
    }
}

function attentionGetter(command: string): () => void {
    let focused = true

    process.stdin.on('keypress', (_str, key) => {
        switch (key.sequence) {
            case xtermFocusIn:
                focused = true
                break

            case xtermFocusOut:
                focused = false
                break
        }
    })

    // Enable focus reporting for this process. This will send key sequence
    // events when the terminal running this process is focused or defocused,
    // which we can use to toggle the focus flag. We'll only exec the command
    // when the user is not focused on the process.

    process.stdout.write(xtermEnableFocusReporting)
    process.on('exit', () => process.stdout.write(xtermDisableFocusReporting))

    return () => {
        if (!focused) {
            exec(command)
        }
    }
}

function runInDocker(options: any) {
    spawn('docker', buildDockerArgs(options), { stdio: 'inherit' }).on('close', code => {
        console.log(`Docker container exited with code ${code}`)
        process.exit(code || 0)
    })
}

const dockerImage = 'aidev:latest'
const containerAidevDir = '/aidev'
const containerConfigDir = '/root/.config/aidev'
const containerWorkspace = '/workspace'
const containerKeyDir = `${containerConfigDir}/keys`
const containerPreferencesDir = `${containerConfigDir}/preferences`
const implicitAidevArgs = ['--one-shot', '--yolo']

function buildDockerArgs(options: any) {
    const hostAidevDir = dirname(__dirname)
    const hostWorkspace = options.cwd || process.cwd()

    const dockerArgs = [
        '--rm',
        '-it',
        ...['-v', `${hostWorkspace}:${containerWorkspace}:rw`],
        ...['-v', `${hostAidevDir}:${containerAidevDir}:ro`],
        ...['-v', `${keyDir()}:${containerKeyDir}:ro`],
        ...['-v', `${preferencesDir()}:${containerPreferencesDir}:ro`],
        ...['-e', `AIDEV_KEY_DIR=${containerKeyDir}`],
        ...['-e', `AIDEV_PREFERENCES_DIR=${containerPreferencesDir}`],
    ]

    const aidevArgs = [
        ...implicitAidevArgs,
        ...['--cwd', containerWorkspace],
        ...(options.history ? ['--history', options.history] : []),
    ]

    const x = ['run', ...dockerArgs, dockerImage, '--', 'bun', `${containerAidevDir}/src/cli.ts`, ...aidevArgs]
    console.log({ x })
    return x
}

main()
