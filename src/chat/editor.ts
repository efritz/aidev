import EventSource from 'eventsource'
import { ChatContext } from './context'

export function createEditorEventSource(port?: number): EventSource | undefined {
    if (!port) {
        return undefined
    }

    return new EventSource(`http://localhost:${port}/open-documents`)
}

export function registerEditorListeners(context: ChatContext, editorEventSource?: EventSource) {
    if (!editorEventSource) {
        return
    }

    editorEventSource.addEventListener('message', event => {
        context.editorState.openFiles = JSON.parse(event.data)
        context.editorState.events.emit('open-files-changed')
    })
}
