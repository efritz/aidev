import * as fs from 'fs'
import * as http from 'http'
import { AddressInfo } from 'net'
import * as vscode from 'vscode'
import { modelNames } from './providers/providers'

const sseHeaders = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
}

const jsonHeaders = {
    'Content-Type': 'application/json',
}

export function activate(context: vscode.ExtensionContext) {
    const sseClients = new Set<http.ServerResponse>()
    const openDocumentURIs = new Set(pathFromTabGroups())

    const sendSSEUpdate = () => {
        const paths = pathsRelativeToWorkspaceRoot([...openDocumentURIs])
        const data = `data: ${JSON.stringify(paths)}\n\n`
        sseClients.forEach(client => client.write(data))
    }

    const onTextDocumentChange =
        (isOpening: boolean) =>
        ({ uri: { fsPath: path } }: vscode.TextDocument) => {
            if (isOpening) {
                if (fs.existsSync(path)) {
                    openDocumentURIs.add(path)
                }
            } else {
                openDocumentURIs.delete(path)
            }

            sendSSEUpdate()
        }

    const createServer = () =>
        http.createServer((req, res) => {
            try {
                if (req.url !== '/open-documents') {
                    res.writeHead(404)
                    res.end()
                    return
                }

                sseClients.add(res)
                req.on('close', () => sseClients.delete(res))

                res.writeHead(200, sseHeaders)
                res.flushHeaders()
                sendSSEUpdate()
            } catch (error: any) {
                res.writeHead(500, jsonHeaders)
                res.end(JSON.stringify({ error: error.message }))
            }
        })

    const startServer = async (server: http.Server): Promise<number> => {
        await new Promise<void>((resolve, reject) => {
            server.on('error', reject)
            server.listen(0, resolve)
        })

        return (server.address() as AddressInfo).port
    }

    const createTerminal = async (command: string): Promise<vscode.Terminal> => {
        const terminal = vscode.window.createTerminal('aidev')
        await terminal.processId
        terminal.sendText(`${command}; exit`)
        terminal.show()
        return terminal
    }

    const chat = async (model?: string) => {
        try {
            const server = createServer()
            const port = await startServer(server)

            const options = [`--port ${port}`, ...(model ? [`--model ${model}`] : [])]
            const terminal = await createTerminal(`ai ${options.join(' ')}`)

            vscode.window.onDidCloseTerminal(t => {
                if (t === terminal) {
                    server.close()
                }
            })
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to start chat: ${error.message}`)
        }
    }

    const chatModel = async () => chat(await vscode.window.showQuickPick(modelNames))

    context.subscriptions.push(
        ...[
            vscode.commands.registerCommand('aidev.chat', chat),
            vscode.commands.registerCommand('aidev.chat-model', chatModel),
            vscode.workspace.onDidOpenTextDocument(onTextDocumentChange(true)),
            vscode.workspace.onDidCloseTextDocument(onTextDocumentChange(false)),
        ],
    )
}

export function deactivate() {}

function pathFromTabGroups() {
    return vscode.window.tabGroups.all
        .flatMap(tabGroup => tabGroup.tabs)
        .map(tab => pathFromTab(tab) ?? '')
        .filter(path => path !== '')
}

function pathFromTab(tab: vscode.Tab): string | undefined {
    if (!(tab.input instanceof vscode.TabInputText)) {
        return undefined
    }

    return tab.input.uri.fsPath
}

function pathsRelativeToWorkspaceRoot(paths: string[]): string[] {
    const folders = vscode.workspace.workspaceFolders ?? []
    if (folders.length !== 1) {
        return []
    }

    const root = folders[0].uri.fsPath
    return paths.filter(path => path.startsWith(root)).map(path => path.replace(root, '.'))
}
