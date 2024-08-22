import * as http from 'http'
import * as vscode from 'vscode'
import { modelNames } from './providers/providers'

export function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = () =>
        vscode.workspace.workspaceFolders?.length === 1 ? vscode.workspace.workspaceFolders[0].uri.fsPath : ''

    const relativeFsPathsForOpenTextDocuments = () =>
        workspaceRoot()
            ? [...openDocumentURIs]
                  .filter(path => path.startsWith(workspaceRoot()))
                  .map(path => path.replace(workspaceRoot(), '.'))
            : []

    const openDocumentURIs: Set<string> = new Set(
        vscode.window.tabGroups.all
            .flatMap(g => g.tabs)
            .map(t => (t.input instanceof vscode.TabInputText && t.input.uri.fsPath) || '')
            .filter(path => path !== ''),
    )

    const startWebServer = (): Promise<{ server: http.Server; port: number }> => {
        return new Promise((resolve, reject) => {
            const server = http.createServer((req, res) => {
                if (req.url === '/open-documents') {
                    const paths = relativeFsPathsForOpenTextDocuments()
                    res.writeHead(200, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify(paths))
                } else {
                    res.writeHead(404)
                    res.end()
                }
            })

            server.on('error', error => reject(error))
            server.listen(0, () => {
                const address = server.address()
                if (address && typeof address === 'object') {
                    resolve({ server, port: address.port })
                } else {
                    reject(new Error('Failed to get server port'))
                }
            })
        })
    }

    const chat = async (model?: string) => {
        try {
            const { server, port } = await startWebServer()
            const command = model ? `ai --model ${model} --port ${port}` : `ai --port ${port}`

            const terminal = vscode.window.createTerminal('aidev')
            await terminal.processId
            terminal.sendText(`${command}; exit`)
            terminal.show()

            context.subscriptions.push(
                ...[
                    terminal,
                    vscode.window.onDidCloseTerminal(closedTerminal => {
                        if (closedTerminal === terminal) {
                            server.close()
                        }
                    }),
                ],
            )
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to start webserver: ${error}`)
        }
    }

    const chatModel = async () => {
        const model = await vscode.window.showQuickPick(modelNames)
        return chat(model)
    }

    context.subscriptions.push(
        ...[
            vscode.commands.registerCommand('aidev.chat', chat),
            vscode.commands.registerCommand('aidev.chat-model', chatModel),
            vscode.workspace.onDidOpenTextDocument(document => openDocumentURIs.add(document.uri.fsPath)),
            vscode.workspace.onDidCloseTextDocument(document => openDocumentURIs.delete(document.uri.fsPath)),
        ],
    )
}

export function deactivate() {}
