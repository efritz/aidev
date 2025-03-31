import { ChatContext, embeddingsStore } from '../chat/context'
import { expandFilePatterns } from '../util/fs/glob'
import { filterIgnoredPaths } from '../util/fs/ignore'
import { safeReadFile } from '../util/fs/safe'
import { hash } from '../util/hash/hash'
import { CancelError } from '../util/interrupts/interrupts'
import { ProgressResult, Updater, withProgress } from '../util/progress/progress'
import { chunkCodeFileAndHydrate } from './code'
import { EmbeddableContent, EmbeddingsStore, RawEmbeddableContent } from './store'

export type IndexingProgress = {
    stateByFile: Map<string, string>
    numChunks: number
    numChunksSummarized: number
    numEmbeddableChunks: number
    numChunksEmbedded: number
}

export async function isIndexUpToDate(context: ChatContext): Promise<boolean> {
    const store = await embeddingsStore(context)
    const { newMetaContent, outdatedHashes } = await analyzeWorkspaceFiles(store)
    return newMetaContent.length === 0 && outdatedHashes.size === 0
}

export async function indexWorkspace(context: ChatContext): Promise<ProgressResult<IndexingProgress>> {
    const index = async (signal: AbortSignal, update: Updater<IndexingProgress>) => {
        const store = await embeddingsStore(context)
        const { newMetaContent, outdatedHashes } = await analyzeWorkspaceFiles(store)
        await store.delete(outdatedHashes)

        const progress: IndexingProgress = {
            stateByFile: new Map(),
            numChunks: 0,
            numChunksSummarized: 0,
            numEmbeddableChunks: 0,
            numChunksEmbedded: 0,
        }
        for (const mc of newMetaContent) {
            progress.stateByFile.set(mc.filename, 'Pending...')
        }
        update(progress)

        // The abort signal passed to us is only used when the user issues a cancellation. To handle
        // an error in a downstream promise, we create a scoped abort controller which we will cancel
        // on cancellation (from above) or on error (from below). This will cancel the entire tree of
        // computation instead of leaving dangling promises finishing up silently in the background.
        const controller = new AbortController()
        signal.addEventListener('abort', () => controller.abort())

        try {
            await Promise.all(
                newMetaContent.map(mc =>
                    handleFile(context, store, mc, controller.signal, progress, () => update(progress)),
                ),
            )
        } catch (error: any) {
            controller.abort()
            throw error
        }

        return progress
    }

    const onProgress = (progress?: IndexingProgress) => {
        if (!progress) {
            return `Indexing workspace...`
        }

        const entries = [...progress.stateByFile.entries()]
        const saved = entries.filter(([_, v]) => v === 'Saved.')
        const active = entries.filter(([_, v]) => v !== 'Saved.')

        const progressWindowSize = 25
        const extraCount = active.length - progressWindowSize
        const snapshot =
            active
                .map(([k, v]) => `${k}: ${v}`)
                .sort()
                .slice(0, progressWindowSize)
                .join('\n') + (extraCount > 0 ? `\n... and ${extraCount} more...` : '')

        return [
            `Indexing workspace...`,
            ...(context.preferences.summarizerModel
                ? [`  - ${progress.numChunksSummarized}/${progress.numChunks} code chunks summarized`]
                : []),
            `  - ${progress.numChunksEmbedded}/${progress.numEmbeddableChunks} chunks embedded`,
            `  - ${saved.length}/${entries.length} files indexed`,
            ``,
            `${snapshot}`,
        ].join('\n')
    }

    try {
        return await context.interruptHandler.withInterruptHandler(signal =>
            withProgress<IndexingProgress>(update => index(signal, update), {
                progress: onProgress,
                success: () => 'Workspace indexed.',
                failure: (_, err) => `Failed to index workspace: ${err}`,
            }),
        )
    } catch (error: any) {
        if (!(error instanceof CancelError)) {
            throw error
        }

        return { ok: false, error }
    }
}

async function analyzeWorkspaceFiles(store: EmbeddingsStore): Promise<{
    newMetaContent: RawEmbeddableContent[]
    outdatedHashes: Set<string>
}> {
    const fsPaths = await filterIgnoredPaths(await expandFilePatterns(['**/*']), true)
    const fsContent: RawEmbeddableContent[] = await Promise.all(
        fsPaths.map(async path => {
            const content = await safeReadFile(path)

            return {
                filename: path,
                filehash: hash(`${path}::${content}`),
                content,
            }
        }),
    )

    const dbFileHashes = await store.hashes()

    return {
        newMetaContent: fsContent.filter(mc => !dbFileHashes.has(mc.filehash)),
        outdatedHashes: dbFileHashes.difference(new Set(fsContent.map(mc => mc.filehash))),
    }
}

async function handleFile(
    context: ChatContext,
    store: EmbeddingsStore,
    file: RawEmbeddableContent,
    signal: AbortSignal,
    progress: IndexingProgress,
    update: () => void,
): Promise<void> {
    const batch = await chunkFileAndHydrate(context, file, signal, progress, update)
    progress.numEmbeddableChunks += batch.length
    progress.stateByFile.set(file.filename, `Embedding ${batch.length} chunks...`)
    update()

    await store.save(file, batch, signal)
    progress.numChunksEmbedded += batch.length
    progress.stateByFile.set(file.filename, 'Saved.')
    update()
}

async function chunkFileAndHydrate(
    context: ChatContext,
    file: RawEmbeddableContent,
    signal: AbortSignal,
    progress: IndexingProgress,
    update: () => void,
): Promise<EmbeddableContent[]> {
    return (await chunkCodeFileAndHydrate(context, file, signal, progress, update)) ?? [file]
}
