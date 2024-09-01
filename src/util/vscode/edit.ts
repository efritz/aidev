import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import { withTempFile } from '../fs/temp'
import { withFileWatcher } from '../fs/watch'
import { CancelError, InterruptHandler } from '../interrupts/interrupts'

export function editString(
    interruptHandler: InterruptHandler,
    args: (tempPath: string) => string[],
    contents: string,
): Promise<string> {
    return withTempFile(contents, async tempPath =>
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
