import readline from 'readline'
import { CancelError, InterruptHandler } from '../interrupts/interrupts'

export interface Questioner {
    question: (prompt: string, signal?: AbortSignal, restoreState?: boolean) => Promise<string>
}

export function createQuestioner(rl: readline.Interface, interruptHandler: InterruptHandler): Questioner {
    let buffer = ''

    return {
        question: async (prompt: string, externalSignal?: AbortSignal, restoreState = false): Promise<string> => {
            if (!restoreState) {
                buffer = ''
            }

            rl.setPrompt(prompt)

            try {
                return await interruptHandler.withInterruptHandler<string>(
                    internalSignal =>
                        new Promise<string>(resolve => {
                            const line = (input: string) => {
                                dispose()
                                buffer = ''
                                resolve(input)
                            }

                            const abortInternal = () => {
                                dispose()
                                buffer = rl.line
                                resolve('')
                            }

                            const abortExternal = () => {
                                dispose()
                                buffer = rl.line
                                rl.write(null, { ctrl: true, name: 'u' })
                                resolve('')
                            }

                            const register = () => {
                                rl.on('line', line)
                                internalSignal.addEventListener('abort', abortInternal)
                                externalSignal?.addEventListener('abort', abortExternal)
                            }

                            const dispose = () => {
                                rl.removeListener('line', line)
                                internalSignal.removeEventListener('abort', abortInternal)
                                externalSignal?.removeEventListener('abort', abortExternal)
                            }

                            rl.write(null, { ctrl: true, name: 'e' }) // Move to end of line
                            rl.write(null, { ctrl: true, name: 'u' }) // Delete text left of cursor
                            rl.write(buffer)
                            register()
                        }),
                )
            } catch (error: any) {
                if (error instanceof CancelError) {
                    process.stdout.write('\n')
                    return ''
                }

                throw error
            }
        },
    }
}
