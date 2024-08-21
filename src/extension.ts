import * as vscode from 'vscode'

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('aidev.run', async () => {
            // TODO
        }),
    )
}

export function deactivate() {}
