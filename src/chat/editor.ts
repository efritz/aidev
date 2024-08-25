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

    const loaded = new Set<string>()

    editorEventSource.addEventListener('message', event => {
        for (const file of loaded) {
            context.contextState.addFile(file, { type: 'editor', currentlyVisible: false })
        }

        const openFiles: string[] = JSON.parse(event.data)
        for (const file of openFiles) {
            loaded.add(file)
            context.contextState.addFile(file, { type: 'editor', currentlyVisible: true })
        }

        context.contextState.events.emit('open-files-changed')
    })
}
