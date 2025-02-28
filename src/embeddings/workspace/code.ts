import Parser from 'tree-sitter'
import { LanguageConfiguration } from './languages'

export interface CodeBlock {
    name: string
    type: string
    startLine: number
    endLine: number
    content: string

    parent?: CodeBlock
    children: CodeBlock[]
}

export async function splitSourceCode(content: string, language: LanguageConfiguration): Promise<CodeBlock[]> {
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
