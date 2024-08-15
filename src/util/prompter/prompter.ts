import readline from 'readline'
import { InterruptHandler } from '../interrupts/interrupts'
import { createOptioner, Optioner } from './options'
import { createQuestioner, Questioner } from './questions'

export interface Prompter extends Questioner, Optioner {}

export function createPrompter(rl: readline.Interface, interruptHandler: InterruptHandler): Prompter {
    const questioner = createQuestioner(rl, interruptHandler)
    return { ...questioner, ...createOptioner(questioner) }
}
