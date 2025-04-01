import { Client, ClientOptions } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { ResourceListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js'
import { ChatContext } from '../../chat/context'

const name = 'aidev-vscode-client'
const version = '0.0.1'
const options: ClientOptions = { capabilities: {} }

export async function createClient(port?: number): Promise<Client | undefined> {
    if (!port) {
        return undefined
    }

    const client = new Client({ name, version }, options)
    const transport = new SSEClientTransport(new URL(`http://localhost:${port}/mcp`) as any)

    await client.connect(transport)

    return client
}

export async function registerContextListeners(context: ChatContext, client?: Client) {
    if (!client) {
        return
    }

    const handler = createUpdateEditorContextHandler(context, client)
    client.setNotificationHandler(ResourceListChangedNotificationSchema, handler)
    await handler()
}

function createUpdateEditorContextHandler(context: ChatContext, client: Client): () => Promise<void> {
    let loaded = new Set<string>()

    return async () => {
        const { resources } = await client.listResources()

        await context.contextStateManager.addFiles([...loaded], { type: 'editor', currentlyOpen: false })
        loaded = new Set(resources.map(({ name }) => name))
        await context.contextStateManager.addFiles([...loaded], { type: 'editor', currentlyOpen: true })

        context.events.emit('open-files-changed')
    }
}
