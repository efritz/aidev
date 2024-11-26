import { stat } from 'fs/promises'
import { createServer as _createServer, RequestListener, Server, ServerResponse } from 'http'
import { AddressInfo } from 'net'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { commands, ExtensionContext, Tab, TabInputText, Terminal, TextDocument, window, workspace } from 'vscode'
import { createModelContextProtocolServer } from './mcp/server'
import { modelNames } from './providers/providers'

const sseHeaders = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
}

const jsonHeaders = {
    'Content-Type': 'application/json',
}

export function activate(context: ExtensionContext) {
    const output = window.createOutputChannel('aidev')

    //
    //

    const sseClients = new Set<ServerResponse>()
    const openDocumentURIs = new Set(pathFromTabGroups())

    const sendSSEUpdate = () => {
        const paths = pathsRelativeToWorkspaceRoot([...openDocumentURIs])
        const data = `data: ${JSON.stringify(paths)}\n\n`
        sseClients.forEach(client => client.write(data))
    }

    const onTextDocumentChange =
        (isOpening: boolean) =>
        ({ uri: { fsPath: path } }: TextDocument) => {
            if (isOpening) {
                stat(path)
                    .then(() => openDocumentURIs.add(path))
                    .catch(() => {})
            } else {
                openDocumentURIs.delete(path)
            }

            sendSSEUpdate()
        }

    //
    //

    // This will be set to the base URL of the server when it starts.
    // We don't know this ahead of time because the server uses a random port.
    var baseURL: string

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
        const modelContextProtocolServer = createModelContextProtocolServer()

        const handlers: {
            method: 'GET' | 'POST'
            path: string
            handler: RequestListener
        }[] = [
            //
            // Model Context Protocol Server implementation

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

            // TODO - replace with notifications?
            {
                method: 'GET',
                path: '/open-documents',
                handler: safe(async (req, res) => {
                    sseClients.add(res)
                    req.on('close', () => sseClients.delete(res))

                    res.writeHead(200, sseHeaders)
                    res.flushHeaders()
                    sendSSEUpdate()
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
        terminal.sendText(`${command}`) // TODO ; exit`)
        terminal.show()
        return terminal
    }

    //
    //

    const chat = async (model?: string) => {
        try {
            const server = createServer()
            const port = await startServer(server)
            baseURL = `http://localhost:${port}`

            const options = [`--port ${port}`, ...(model ? [`--model ${model}`] : [])]
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

    const chatModel = async () => chat(await window.showQuickPick(modelNames))

    context.subscriptions.push(
        ...[
            commands.registerCommand('aidev.chat', chat),
            commands.registerCommand('aidev.chat-model', chatModel),
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

function pathsRelativeToWorkspaceRoot(paths: string[]): string[] {
    const folders = workspace.workspaceFolders ?? []
    if (folders.length !== 1) {
        return []
    }

    const root = folders[0].uri.fsPath
    return paths.filter(path => path.startsWith(root)).map(path => path.replace(root, '.'))
}
