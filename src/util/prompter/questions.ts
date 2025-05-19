import readline from 'readline'
import { CompleterType, setCompleterType } from '../../chat/completer'
import { CancelError, InterruptHandler } from '../interrupts/interrupts'

export interface Questioner {
    question: (
        prompt: string,
        completerType: CompleterType,
        signal?: AbortSignal,
        restoreState?: boolean,
    ) => Promise<string>
}

export function createQuestioner(
    rl: readline.Interface,
    interruptHandler: InterruptHandler,
    attention: () => void,
): Questioner {
    let buffer = ''

    return {
        question: async (
            prompt: string,
            completerType: CompleterType,
            externalSignal?: AbortSignal,
            restoreState = false,
        ): Promise<string> => {
            rl.setPrompt(prompt)
            setCompleterType(completerType)
            attention()

            if (!restoreState) {
                buffer = ''
            }

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
