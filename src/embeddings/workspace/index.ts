import { ChatContext, embeddingsStore } from '../../chat/context'
import { expandFilePatterns } from '../../util/fs/glob'
import { filterIgnoredPaths } from '../../util/fs/ignore'
import { safeReadFile } from '../../util/fs/safe'
import { hash } from '../../util/hash/hash'
import { CancelError } from '../../util/interrupts/interrupts'
import { ProgressResult, Updater, withProgress } from '../../util/progress/progress'
import { EmbeddableContent, EmbeddingsStore, RawEmbeddableContent } from '../store/store'
import { CodeBlock, splitSourceCode } from './code'
import { SupportedLanguage, treesitterLanguages } from './languages'
import { summarizeCodeBlocks, Summary } from './summarizer'

export type IndexingProgress = {
    stateByFile: Map<string, string>
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

        const progress: IndexingProgress = { stateByFile: new Map() }
        for (const mc of newMetaContent) {
            progress.stateByFile.set(mc.filename, 'Pending...')
        }
        update(progress)

        await Promise.all(
            newMetaContent.map(mc => handleFile(context, store, mc, signal, progress, () => update(progress))),
        )

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

        return `Indexing workspace... ${saved.length}/${entries.length} files indexed\n\n${snapshot}`
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
    const updateState = (state: string) => {
        progress.stateByFile.set(file.filename, state)
        update()
    }

    const batch = await chunkFileAndHydrate(context, file, signal, updateState)
    updateState(`Embedding ${batch.length} chunks...`)
    await store.save(batch, signal)
    updateState('Saved.')
}

async function chunkFileAndHydrate(
    context: ChatContext,
    file: RawEmbeddableContent,
    signal: AbortSignal,
    update: (state: string) => void,
): Promise<EmbeddableContent[]> {
    for (const [languageName, { extensions }] of Object.entries(treesitterLanguages)) {
        if (!extensions.some(extension => file.filename.endsWith(extension))) {
            continue
        }

        update('Splitting code...')
        const blocks = await splitSourceCode(file.content, languageName as SupportedLanguage)

        if (blocks.length === 0) {
            continue
        }

        let done = 0
        update(`Summarizing ${done}/${blocks.length} code chunks...`)
        const summariesByBlock = await summarizeCodeBlocks(context, file, blocks, signal, () => {
            done++
            update(`Summarizing ${done}/${blocks.length} code chunks...`)
        })

        return blocks.map(block => blockToChunk(file, summariesByBlock, block))
    }

    return [file]
}

function blockToChunk(
    file: RawEmbeddableContent,
    summariesByBlock: Map<CodeBlock, Summary>,
    block: CodeBlock,
): EmbeddableContent {
    let content = block.content
    const header: string[] = []
    const metadata: string[] = []
    const blockSummary = summariesByBlock.get(block)!

    header.push(`# ${block.name}`)
    header.push(``)
    header.push(`Filename: ${file.filename}`)
    header.push(`Type: ${block.type}`)
    header.push(`Signature: ${blockSummary.signature}`)
    header.push(``)
    header.push(blockSummary.detailedSummary)

    if (block.children.length > 0) {
        metadata.push(`## Children`)
        metadata.push(``)
        metadata.push(
            `The following chunks are defined within this chunk of source code. Their full implementation have been elided from this chunk.`,
        )

        for (const child of block.children) {
            const childSummary = summariesByBlock.get(child)!

            metadata.push(``)
            metadata.push(`### ${child.name}`)
            metadata.push(``)
            metadata.push(`Type: ${child.type}`)
            metadata.push(`Signature: ${childSummary.signature}`)
            metadata.push(``)
            metadata.push(childSummary.conciseSummary)

            content = content.replace(child.content, `[...Implementation of ${child.name} omitted...]`)
        }

        metadata.push(``)
    }

    metadata.push('## Code')
    metadata.push('```\n' + content + '\n```')

    return {
        filename: file.filename,
        filehash: file.filehash,
        content: block.content,
        name: block.name,
        metadata: {
            header: header.join('\n'),
            detail: metadata.join('\n'),
        },
    }
}
