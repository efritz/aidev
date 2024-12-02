import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { commands, Location, LocationLink, Position, TextDocument, workspace } from 'vscode'
import { JSONSchemaDataType } from '../../../../tools/tool'
import { createResource } from '../../../tools/resource'
import { ExecutionContext } from '../context'
import { Tool } from '../tool'

type Locations = (Location | LocationLink)[]

export const langServer: Tool = {
    name: 'langserver',
    description: 'Query symbol details from a language server.',
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

        const findSymbolPositions = (text: string, symbolName: string, document: TextDocument): Position[] => {
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

        const document = await workspace.openTextDocument(filePath)
        const text = document.getText()
        const symbolPositions = findSymbolPositions(text, symbolName, document)

        if (symbolPositions.length === 0) {
            return { content: [] }
        }

        const position = symbolPositions[0] // TODO

        const [definitions, references] = await Promise.all([
            commands.executeCommand<Locations>('vscode.executeDefinitionProvider', document.uri, position),
            commands.executeCommand<Locations>('vscode.executeReferenceProvider', document.uri, position),
        ])

        return {
            content: [
                createResource(`aidev://symbol-result/${symbolName}`, '', {
                    definitions: extractURIs(definitions),
                    references: extractURIs(references),
                }),
            ],
        }
    },
}

function extractURIs(locations: Locations): string[] {
    return locations.map(loc => ('targetUri' in loc ? loc.targetUri.toString() : loc.uri.toString())) || []
}
