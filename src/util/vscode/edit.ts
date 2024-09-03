import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import { withTempFileContents } from '../fs/temp'
import { withFileWatcher } from '../fs/watch'
import { CancelError, InterruptHandler } from '../interrupts/interrupts'

export function withContentEditor(interruptHandler: InterruptHandler, contents: string): Promise<string> {
    return withEditorOverTempFile(interruptHandler, contents, tempPath => [tempPath])
}

export function withDiffEditor(
    interruptHandler: InterruptHandler,
    originalPath: string,
    contents: string,
): Promise<string> {
    return withEditorOverTempFile(interruptHandler, contents, tempPath => ['--diff', originalPath, tempPath])
}

function withEditorOverTempFile(
    interruptHandler: InterruptHandler,
    contents: string,
    args: (tempPath: string) => string[],
): Promise<string> {
    return withTempFileContents(contents, tempPath =>
        withFileWatcher(tempPath, watcher =>
            interruptHandler.withInterruptHandler(
                () =>
                    new Promise<string>((resolve, reject) => {
                        watcher.on('change', () => {
                            const newContent = readFileSync(tempPath, 'utf-8')
                            if (newContent !== contents) {
                                resolve(newContent)
                            }
                        })

                        spawn('code', [...args(tempPath), '--wait'])
                            .on('exit', () => reject(new CancelError('User canceled')))
                            .on('error', error => reject(new Error(`Failed to open editor: ${error.message}`)))
                    }),
            ),
        ),
    )
}
