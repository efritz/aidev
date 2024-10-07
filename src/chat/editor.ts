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
            const _ = context.contextStateManager.addFile(file, { type: 'editor', currentlyOpen: false })
        }

        const openFiles: string[] = JSON.parse(event.data)
        for (const file of openFiles) {
            loaded.add(file)
            const _ = context.contextStateManager.addFile(file, { type: 'editor', currentlyOpen: true })
        }

        context.contextStateManager.events.emit('open-files-changed')
    })
}
