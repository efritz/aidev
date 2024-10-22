import { spawn } from 'child_process'
import { readFile } from 'fs/promises'
import { withTempFileContents } from '../fs/temp'
import { withFileWatcher } from '../fs/watch'
import { CancelError, InterruptHandler } from '../interrupts/interrupts'

export function withContentEditor(
    interruptHandler: InterruptHandler,
    contents: string,
    referencePath: string = '',
): Promise<string> {
    return withEditorOverTempFile(interruptHandler, contents, tempPath => [tempPath], referencePath)
}

export function withDiffEditor(
    interruptHandler: InterruptHandler,
    originalPath: string,
    contents: string,
): Promise<string> {
    return withEditorOverTempFile(
        interruptHandler,
        contents,
        tempPath => ['--diff', originalPath, tempPath],
        originalPath,
    )
}

function withEditorOverTempFile(
    interruptHandler: InterruptHandler,
    contents: string,
    args: (tempPath: string) => string[],
    referencePath: string = '',
): Promise<string> {
    return withTempFileContents(
        contents,
        tempPath =>
            withFileWatcher(tempPath, watcher =>
                interruptHandler.withInterruptHandler(
                    () =>
                        new Promise<string>((resolve, reject) => {
                            watcher.on('change', () => {
                                readFile(tempPath, 'utf-8')
                                    .then(newContent => {
                                        if (newContent !== contents) {
                                            resolve(newContent)
                                        }
                                    })
                                    .catch(() => {})
                            })

                            spawn('code', [...args(tempPath), '--wait'])
                                .on('exit', () => reject(new CancelError('User canceled')))
                                .on('error', error => reject(new Error(`Failed to open editor: ${error.message}`)))
                        }),
                ),
            ),
        referencePath,
    )
}
