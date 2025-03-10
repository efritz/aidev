import Parser from 'tree-sitter'
import { ChatContext } from '../chat/context'
import { IndexingProgress } from '.'
import { createParsers, LanguageConfiguration } from './languages'
import { EmbeddableContent, RawEmbeddableContent } from './store'
import { CodeBlock, summarizeCodeBlocks, Summary } from './summarizer'

export async function chunkCodeFileAndHydrate(
    context: ChatContext,
    file: RawEmbeddableContent,
    signal: AbortSignal,
    progress: IndexingProgress,
    update: () => void,
): Promise<EmbeddableContent[] | undefined> {
    for (const language of await createParsers()) {
        if (!language.extensions.some(extension => file.filename.endsWith(extension))) {
            continue
        }

        progress.stateByFile.set(file.filename, 'Splitting code...')
        update()

        const blocks = await splitSourceCode(file.content, language)
        if (blocks.length === 0) {
            continue
        }

        if (!context.preferences.summarizerModel) {
            return blocks.map(block => ({
                filename: file.filename,
                filehash: file.filehash,
                content: block.content,
                name: block.name,
            }))
        }

        let done = 0
        progress.numChunks += blocks.length
        progress.stateByFile.set(file.filename, `Summarizing ${done}/${blocks.length} code chunks...`)
        update()

        const summariesByBlock = await summarizeCodeBlocks(context, file, blocks, signal, () => {
            done++
            progress.numChunksSummarized++
            progress.stateByFile.set(file.filename, `Summarizing ${done}/${blocks.length} code chunks...`)
            update()
        })

        return blocks.map(block => blockToChunk(file, summariesByBlock, block))
    }

    return undefined
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

async function splitSourceCode(content: string, language: LanguageConfiguration): Promise<CodeBlock[]> {
    const tree = language.parser.parse(content)

    const blocks: CodeBlock[] = []
    for (const [queryType, query] of language.queries.entries()) {
        for (const match of query.matches(tree.rootNode)) {
            const block = convertMatchToCodeBlock(content, queryType, match)
            if (block) {
                blocks.push(block)
            }
        }
    }

    // Sort blocks by start line
    blocks.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine)

    const nested = new Map<number, number>()
    for (let parentIndex = 0; parentIndex < blocks.length; parentIndex++) {
        const parent = blocks[parentIndex]

        for (let childIndex = parentIndex + 1; childIndex < blocks.length; childIndex++) {
            const child = blocks[childIndex]

            if (child.endLine < parent.endLine) {
                // Based on iteration order, we shoulld get the _most specific parent_
                // as the last writer to this map. We don't have to worry about untangling
                // ancestor/descendant relationships after this map is constructed.
                nested.set(childIndex, parentIndex)
            } else {
                break
            }
        }
    }

    for (const [childIndex, parentIndex] of nested.entries()) {
        const child = blocks[childIndex]
        const parent = blocks[parentIndex]
        child.parent = parent
        parent.children.push(child)
    }

    return blocks
}

function convertMatchToCodeBlock(content: string, queryType: string, match: Parser.QueryMatch): CodeBlock | undefined {
    const main = match.captures.find(c => c.name !== 'name')
    const name = match.captures.find(c => c.name === 'name')
    if (!main || !name) {
        return undefined
    }

    return {
        name: name.node.text,
        type: queryType,
        startLine: main.node.startPosition.row + 1,
        endLine: main.node.endPosition.row + 1,
        content: content.slice(main.node.startIndex, main.node.endIndex),

        parent: undefined, // populated after all blocks are constructed
        children: [], // populated after all blocks are constructed
    }
}
