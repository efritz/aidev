import * as vscode from 'vscode'
import { modelNames } from './providers/providers'

export function activate(context: vscode.ExtensionContext) {
    const chat = async (model?: string) => {
        const terminal = vscode.window.createTerminal('aidev')
        terminal.sendText(`${model ? `ai --model ${model}` : 'ai'}; exit`, true)
        terminal.show()
    }

    context.subscriptions.push(
        ...[
            vscode.commands.registerCommand('aidev.chat', chat),
            vscode.commands.registerCommand('aidev.chat-model', async () =>
                chat(await vscode.window.showQuickPick(modelNames)),
            ),
        ],
    )
}

export function deactivate() {}
