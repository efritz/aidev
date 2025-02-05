import { stat } from 'fs/promises'
import { createServer as _createServer, RequestListener, Server } from 'http'
import { AddressInfo } from 'net'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { commands, ExtensionContext, Tab, TabInputText, Terminal, TextDocument, window, workspace } from 'vscode'
import { createModelContextProtocolServer } from './mcp/server/server'

const jsonHeaders = {
    'Content-Type': 'application/json',
}

export function activate(context: ExtensionContext) {
    const output = window.createOutputChannel('aidev')
    const openDocumentURIs = new Set(pathFromTabGroups())
    const modelContextProtocolServer = createModelContextProtocolServer(output, openDocumentURIs)

    //
    //

    // This will be set to the base URL of the server when it starts.
    // We don't know this ahead of time because the server uses a random port.
    let baseURL: string

    const createServer = () => {
        const safe =
            (handler: RequestListener): RequestListener =>
            async (req, res) => {
                try {
                    await handler(req, res)
                } catch (error: any) {
                    res.writeHead(500, jsonHeaders)
                    res.end(JSON.stringify({ error: error.message }))
                    output.appendLine(`Error handling ${req.method} ${req.url}: ${error.message}`)
                }
            }

        let transport: SSEServerTransport

        const handlers: {
            method: 'GET' | 'POST'
            path: string
            handler: RequestListener
        }[] = [
            {
                method: 'GET',
                path: '/mcp',
                handler: safe(async (req, res) => {
                    if (transport) {
                        throw new Error('MCP server already running')
                    }

                    transport = new SSEServerTransport('/mcp', res)
                    await modelContextProtocolServer.connect(transport)
                }),
            },
            {
                method: 'POST',
                path: '/mcp',
                handler: safe(async (req, res) => {
                    if (!transport) {
                        throw new Error('MCP server not running')
                    }

                    try {
                        await transport.handlePostMessage(req, res)
                    } catch (error: any) {
                        res.writeHead(500, jsonHeaders)
                        res.end(JSON.stringify({ error: error.message }))
                    }
                }),
            },
        ]

        return _createServer(async (req, res) => {
            const { pathname } = new URL(req.url ?? '', baseURL)

            for (const { method, path, handler } of handlers) {
                if (req.method === method && pathname === path) {
                    return handler(req, res)
                }
            }

            res.writeHead(404)
            res.end(JSON.stringify({ error: 'Not found', method: req.method, url: req.url }))
            output.appendLine(`Error handling ${req.method} ${pathname}: Not found`)
            return
        })
    }

    const startServer = async (server: Server): Promise<number> => {
        await new Promise<void>((resolve, reject) => {
            server.on('error', reject)
            server.listen(0, resolve)
        })

        return (server.address() as AddressInfo).port
    }

    //
    //

    const createTerminal = async (command: string): Promise<Terminal> => {
        const terminal = window.createTerminal('aidev')
        await terminal.processId
        terminal.sendText(`${command}; exit`)
        terminal.show()
        return terminal
    }

    //
    //

    const chat = async ({ model, history }: { model?: string; history?: string } = {}) => {
        try {
            const server = createServer()
            const port = await startServer(server)
            baseURL = `http://localhost:${port}`

            const options = [
                `--port ${port}`,
                ...(model ? [`--model ${model}`] : []),
                ...(history ? [`--history ${history}`] : []),
            ]
            const terminal = await createTerminal(`ai ${options.join(' ')}`)

            window.onDidCloseTerminal(t => {
                if (t === terminal) {
                    server.close()
                }
            })
        } catch (error: any) {
            window.showErrorMessage(`Failed to start chat: ${error.message}`)
        }
    }

    const chatHistory = async () => {
        const selection = await window.showOpenDialog({ title: 'Open chat history' })
        if (!selection) {
            return
        }

        return chat({ history: selection[0].path })
    }

    //
    //

    const onTextDocumentChange =
        (isOpening: boolean) =>
        async ({ uri: { fsPath: path } }: TextDocument) => {
            if (isOpening) {
                stat(path)
                    .then(() => openDocumentURIs.add(path))
                    .catch(() => {})
            } else {
                openDocumentURIs.delete(path)
            }

            await modelContextProtocolServer.sendResourceListChanged()
        }

    //
    //

    context.subscriptions.push(
        ...[
            commands.registerCommand('aidev.chat', chat),
            commands.registerCommand('aidev.chat-history', chatHistory),
            workspace.onDidOpenTextDocument(onTextDocumentChange(true)),
            workspace.onDidCloseTextDocument(onTextDocumentChange(false)),
        ],
    )
}

export function deactivate() {}

function pathFromTabGroups() {
    return window.tabGroups.all
        .flatMap(tabGroup => tabGroup.tabs)
        .map(tab => pathFromTab(tab) ?? '')
        .filter(path => path !== '')
}

function pathFromTab(tab: Tab): string | undefined {
    if (!(tab.input instanceof TabInputText)) {
        return undefined
    }

    return tab.input.uri.fsPath
}
