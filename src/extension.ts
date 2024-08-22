import * as http from 'http'
import { AddressInfo } from 'net'
import * as vscode from 'vscode'
import { modelNames } from './providers/providers'

export function activate(context: vscode.ExtensionContext) {
    const openDocumentURIs: Set<string> = new Set(
        vscode.window.tabGroups.all
            .flatMap(g => g.tabs)
            .map(t => (t.input instanceof vscode.TabInputText && t.input.uri.fsPath) || '')
            .filter(path => path !== ''),
    )

    const workspaceRoot = () =>
        vscode.workspace.workspaceFolders?.length === 1 ? vscode.workspace.workspaceFolders[0].uri.fsPath : ''

    const relativeFsPathsForOpenTextDocuments = () =>
        workspaceRoot()
            ? [...openDocumentURIs]
                  .filter(path => path.startsWith(workspaceRoot()))
                  .map(path => path.replace(workspaceRoot(), '.'))
            : []

    const createServer = () =>
        http.createServer((req, res) => {
            try {
                if (req.url === '/open-documents') {
                    const paths = relativeFsPathsForOpenTextDocuments()
                    res.writeHead(200, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify(paths))
                } else {
                    res.writeHead(404)
                    res.end()
                }
            } catch (error: any) {
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: error.message }))
            }
        })

    const startServer = async (server: http.Server): Promise<number> => {
        await new Promise<void>((resolve, reject) => {
            server.on('error', reject)
            server.listen(0, resolve)
        })

        const { port } = server.address() as AddressInfo
        return port
    }

    const showTerminal = async (command: string): Promise<vscode.Terminal> => {
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
            const terminal = await showTerminal(`ai ${options.join(' ')}`)

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
            vscode.workspace.onDidOpenTextDocument(doc => openDocumentURIs.add(doc.uri.fsPath)),
            vscode.workspace.onDidCloseTextDocument(doc => openDocumentURIs.delete(doc.uri.fsPath)),
        ],
    )
}

export function deactivate() {}
