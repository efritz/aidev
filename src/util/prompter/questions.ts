import readline from 'readline'
import { CancelError, InterruptHandler } from '../interrupts/interrupts'

export interface Questioner {
    question: (prompt: string) => Promise<string>
}

export function createQuestioner(rl: readline.Interface, interruptHandler: InterruptHandler): Questioner {
    return {
        question: async (prompt: string): Promise<string> => {
            try {
                return await interruptHandler.withInterruptHandler<string>(
                    signal => new Promise<string>(resolve => rl.question(prompt, { signal }, resolve)),
                )
            } catch (error: any) {
                if (error instanceof CancelError) {
                    return ''
                }

                throw error
            }
        },
    }
}
