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

    const chat = async (model?: string) => {
        const terminal = vscode.window.createTerminal('aidev')
        await terminal.processId
        terminal.show()

        terminal.sendText(`${model ? `ai --model ${model}` : 'ai'}`)
        const paths = relativeFsPathsForOpenTextDocuments()
        if (paths.length > 0) {
            // TODO - expose this as tool result instead
            terminal.sendText(`:load ${paths.join(' ')}`)
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
