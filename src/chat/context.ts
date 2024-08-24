import EventEmitter from 'events'
import { Provider } from '../providers/provider'
import { InterruptHandler } from '../util/interrupts/interrupts'
import { Prompter } from '../util/prompter/prompter'

export type ChatContext = {
    model: string
    interruptHandler: InterruptHandler
    prompter: Prompter
    provider: Provider
    editorState: EditorState
}

export type EditorState = {
    openFiles: string[]
    events: EventEmitter
}
