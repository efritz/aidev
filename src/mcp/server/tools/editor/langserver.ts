import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
    Location as _Location,
    commands,
    FoldingRange,
    Hover,
    LocationLink,
    Position,
    Range,
    TextDocument,
    Uri,
    workspace,
} from 'vscode'
import { JSONSchemaDataType } from '../../../../tools/tool'
import { createResource } from '../../../tools/resource'
import { ExecutionContext } from '../context'
import { Tool } from '../tool'

export const langServer: Tool = {
    name: 'langserver',
    description:
        'Extract hover text, definition, reference, and implementation details for a symbol from a language server.',
    parameters: {
        type: JSONSchemaDataType.Object,
        properties: {
            symbolName: {
                type: JSONSchemaDataType.String,
                description: 'The name of the symbol to query.',
            },
            filePath: {
                type: JSONSchemaDataType.String,
                description: 'The absolute path of the file containing the symbol.',
            },
        },
        required: ['symbolName', 'filePath'],
    },
    execute: async (context: ExecutionContext, args: any): Promise<CallToolResult> => {
        const { symbolName, filePath } = args

        const document = await workspace.openTextDocument(filePath)
        const text = document.getText()
        const symbolPositions = findSymbolPositions(text, symbolName, document)

        if (symbolPositions.length === 0) {
            return { content: [] }
        }

        // TODO - how to disambiguate?
        const position = symbolPositions[0]

        const [hover, definitions, references, implementations] = await Promise.all([
            commands.executeCommand<Hover[]>('vscode.executeHoverProvider', document.uri, position),
            commands.executeCommand<Location[]>('vscode.executeDefinitionProvider', document.uri, position),
            commands.executeCommand<Location[]>('vscode.executeReferenceProvider', document.uri, position),
            commands.executeCommand<Location[]>('vscode.executeImplementationProvider', document.uri, position),
        ])

        return {
            content: [
                createResource(
                    `aidev://symbol-result/${symbolName}`,
                    '',
                    JSON.stringify(
                        {
                            hoverText: serializeHover(hover),
                            definitions: extractLocationCount(definitions || []),
                            references: extractLocationCount(references || []),
                            implementations: await extractImplementationInfo(implementations || []),
                        },
                        null,
                        4,
                    ),
                ),
            ],
        }
    },
}

//
//

function findSymbolPositions(text: string, symbolName: string, document: TextDocument): Position[] {
    const positions: Position[] = []
    const regex = new RegExp(`\\b${symbolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
        const offset = match.index
        const position = document.positionAt(offset)
        positions.push(position)
    }

    return positions
}

//
//

type Location = _Location | LocationLink
type LocationRange = { uri: Uri; range: Range }
type LocationRanges = { uri: Uri; ranges: Range[] }
type LocationMetadata = { uri: string; totalCount: number }
type ImplementationContext = { symbolName?: string; text: string }
type ImplementationMetadata = LocationMetadata & { contexts: ImplementationContext[] }

function serializeHover(hover: Hover[]): string {
    return hover.flatMap(({ contents }) => contents.map(content => content.toString())).join('\n\n')
}

function extractLocationCount(locations: Location[]): LocationMetadata[] {
    return extractLocationRanges(locations).map(({ uri, ranges }) => ({ uri: uri.fsPath, totalCount: ranges.length }))
}

function extractLocationRanges(locations: Location[]): LocationRanges[] {
    const rangesByURI = new Map<Uri, Range[]>()
    for (const location of locations) {
        const { uri, range } = extractLocationRange(location)
        const ranges = rangesByURI.get(uri) || []
        ranges.push(range)
        rangesByURI.set(uri, ranges)
    }

    return Array.from(rangesByURI.entries()).map(([uri, ranges]) => ({ uri, ranges }))
}

function extractLocationRange(loc: Location): LocationRange {
    if ('targetUri' in loc) {
        return { uri: loc.targetUri, range: loc.targetRange }
    }

    return { uri: loc.uri, range: loc.range }
}

async function extractImplementationInfo(locations: Location[]): Promise<ImplementationMetadata[]> {
    return await Promise.all(
        extractLocationRanges(locations).map(async ({ uri, ranges }) => extractImplementationContext(uri, ranges)),
    )
}

async function extractImplementationContext(uri: Uri, ranges: Range[]): Promise<ImplementationMetadata> {
    const document = await workspace.openTextDocument(uri)
    const foldingRanges = await commands.executeCommand<FoldingRange[]>(
        'vscode.executeFoldingRangeProvider',
        document.uri,
    )

    const contexts = await Promise.all(
        ranges.map(async range => {
            const containingRanges = (foldingRanges || []).filter(fold => {
                return fold.start <= range.start.line && fold.end >= range.end.line
            })

            if (containingRanges.length === 0) {
                return undefined
            }

            containingRanges.sort((a, b) => b.end - b.start - (a.end - a.start))
            const foldRange = containingRanges[containingRanges.length - 1]
            const start = new Position(foldRange.start, 0)
            const end = new Position(foldRange.end, document.lineAt(foldRange.end).text.length)
            return { text: document.getText(new Range(start, end)) }
        }),
    )

    return {
        uri: uri.fsPath,
        totalCount: ranges.length,
        contexts: contexts.filter(f => f !== undefined),
    }
}
