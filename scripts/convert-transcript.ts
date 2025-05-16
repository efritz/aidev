import { readFile, writeFile } from 'fs/promises'
import { program } from 'commander'
import { reviver, SaveFilePayload } from '../src/chat/commands/save'
import { ContextState, createContextState } from '../src/context/state'
import { Conversation } from '../src/conversation/conversation'
import { createConversation as createAnthropicConversation } from '../src/providers/anthropic/conversation'
import { createConversation as createGoogleConversation } from '../src/providers/google/conversation'
import { createConversation as createGroqConversation } from '../src/providers/groq/conversation'
import { createConversation as createOllamaConversation } from '../src/providers/ollama/conversation'
import { createConversation as createOpenAIConversation } from '../src/providers/openai/conversation'
import { getPreferences } from '../src/providers/preferences'
import { buildSystemPrompt } from '../src/system'

async function main() {
    program
        .name('convert-transcript')
        .description('Convert chat transcripts into provider messages format')
        .argument('<inFilename>', 'Path to the history file to convert')
        .argument('[outFilename]', 'Path to the provider messages file to write', './provider-messages.json')
        .option('-p, --provider <provider>', 'Provider to use for conversion', 'Anthropic')
        .action(async (inFilename, outFilename) => {
            const providerName = program.opts()['provider'] ?? 'Anthropic'
            await writeFile(outFilename, await convertHistoryToProviderMessages(inFilename, providerName))
            console.log(`Converted ${inFilename} to ${outFilename} using ${providerName}`)
        })

    program.parse()
}

const conversationFactories: Record<string, (contextState: ContextState, system: string) => Conversation<any>> = {
    anthropic: createAnthropicConversation,
    google: createGoogleConversation,
    openai: createOpenAIConversation,
    groq: createGroqConversation,
    ollama: createOllamaConversation,
}

async function convertHistoryToProviderMessages(inFilename: string, providerName: string): Promise<string> {
    const content = await readFile(inFilename, 'utf8')
    const { messages, contextFiles, contextDirectories }: SaveFilePayload = JSON.parse(content, reviver)

    const createConversation = conversationFactories[providerName.toLowerCase()]
    if (!createConversation) {
        throw new Error(`Unsupported provider: ${providerName}`)
    }

    const contextState = await createContextState()
    contextState.setFiles(new Map(Object.entries(contextFiles)))
    contextState.setDirectories(new Map(Object.entries(contextDirectories)))

    const preferences = await getPreferences()
    const system = await buildSystemPrompt(preferences)

    const conversation = createConversation(contextState, system)
    conversation.setMessages(messages)
    return JSON.stringify(await conversation.providerMessages(), null, '\t')
}

main()
