import * as vscode from 'vscode'

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('aidev.run', async () => {
            const editor = vscode.window.activeTextEditor
            if (!editor) {
                vscode.window.showErrorMessage('Cannot edit file, expected an active text editor.')
                return
            }

            const oldContents = editor.document.getText()
            if (oldContents === '') {
                vscode.window.showErrorMessage('Cannot edit file, expected a non-empty file.')
                return
            }

            editor.edit(editBuilder => replaceAll(editor, editBuilder, 'TEST'))
        }),
    )
}

export function deactivate() {}

const replaceAll = (editor: vscode.TextEditor, eb: vscode.TextEditorEdit, newContents: string): void => {
    const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length),
    )

    eb.replace(fullRange, newContents)
}
