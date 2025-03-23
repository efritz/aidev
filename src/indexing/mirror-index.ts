import fs from 'fs/promises'
import path from 'path'
import { expandFilePatterns } from '../util/fs/glob'
import { filterIgnoredPaths } from '../util/fs/ignore'
import { getScopePath } from './code'
import { createParsers, extractCodeBlockFromMatch, extractCodeMatches } from './languages'
import { HierarchicalCodeBlock } from './summarizer'

/**
 * Mirrors indexed files from a source directory to a target directory,
 * adding chunk delimiters to show what parts of the file are indexed.
 */
export async function mirrorIndexedFiles(
    sourceDir: string,
    targetDir: string,
    options: {
        filePatterns?: string[]
        verbose?: boolean
    } = {},
): Promise<void> {
    const { filePatterns = ['**/*'], verbose = false } = options

    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true })

    // Get all parsers
    const parsers = await createParsers()

    // Get all files in source directory matching patterns
    const files = await getAllFiles(sourceDir, filePatterns)

    if (verbose) {
        console.log(`Found ${files.length} files to process`)
    }

    // Process each file
    for (const file of files) {
        const relativePath = path.relative(sourceDir, file)
        const targetPath = path.join(targetDir, relativePath)

        // Create target directory if it doesn't exist
        await fs.mkdir(path.dirname(targetPath), { recursive: true })

        // Read file content
        const content = await fs.readFile(file, 'utf-8')

        // Find matching parser for this file
        const matchingParser = parsers.find(parser => parser.extensions.some(ext => file.endsWith(ext)))

        if (!matchingParser) {
            // If no parser matches, just copy the file as-is
            await fs.writeFile(targetPath, content)
            if (verbose) {
                console.log(`Copied (no parser): ${relativePath}`)
            }
            continue
        }

        // Extract code blocks
        const codeMatches = extractCodeMatches(content, matchingParser)
        const blocks: HierarchicalCodeBlock[] = []

        for (const { queryType, match } of codeMatches) {
            const block = extractCodeBlockFromMatch(content, queryType, match)
            if (block) {
                blocks.push({
                    ...block,
                    parent: undefined,
                    children: [],
                })
            }
        }

        // Sort blocks by start line
        blocks.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine)

        // Build parent-child relationships
        const nested = new Map<number, number>()
        for (let parentIndex = 0; parentIndex < blocks.length; parentIndex++) {
            const parent = blocks[parentIndex]

            for (let childIndex = parentIndex + 1; childIndex < blocks.length; childIndex++) {
                const child = blocks[childIndex]

                if (child.endLine <= parent.endLine) {
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

        // Create mirrored file with chunk delimiters
        // Instead of trying to insert markers at specific line positions, let's rebuild the file line by line
        const contentLines = content.split('\n')
        const outputLines: string[] = []

        // Create a map of line numbers to chunk start/end markers
        const startMarkers = new Map<number, string[]>()
        const endMarkers = new Map<number, string[]>()

        // Add chunk start and end markers to the maps
        for (const block of blocks) {
            // Include all blocks, both top-level and nested
            const startLine = block.startLine - 1
            const endLine = block.endLine

            // Build the scope path showing all ancestors
            const scopePath = getScopePath(block)
            const scopeInfo = scopePath ? ` scope="${scopePath}"` : ''

            // Use a format that will naturally fold in VSCode
            // Using a comment format with opening/closing markers
            const startMarker = `// #region CHUNK: ${block.type} ${block.name}${scopeInfo}`
            const endMarker = `// #endregion CHUNK: ${block.name}${scopeInfo}`

            if (!startMarkers.has(startLine)) {
                startMarkers.set(startLine, [])
            }
            startMarkers.get(startLine)!.push(startMarker)

            if (!endMarkers.has(endLine)) {
                endMarkers.set(endLine, [])
            }
            endMarkers.get(endLine)!.push(endMarker)
        }

        // Build the output file line by line
        for (let i = 0; i < contentLines.length; i++) {
            // Add any end markers for this line first
            if (endMarkers.has(i)) {
                outputLines.push(...endMarkers.get(i)!)
            }

            // Add any start markers for this line
            if (startMarkers.has(i)) {
                outputLines.push(...startMarkers.get(i)!)
            }

            // Add the content line
            outputLines.push(contentLines[i])
        }

        // Handle any markers that might be after the last line
        const lastLine = contentLines.length
        if (endMarkers.has(lastLine)) {
            outputLines.push(...endMarkers.get(lastLine)!)
        }
        if (startMarkers.has(lastLine)) {
            outputLines.push(...startMarkers.get(lastLine)!)
        }

        // Write the file with the new content
        await fs.writeFile(targetPath, outputLines.join('\n'))

        // File has already been written in the previous step

        if (verbose) {
            console.log(`Mirrored with ${blocks.length} chunks: ${relativePath}`)
        }
    }
}

/**
 * Gets all files in a directory matching the given patterns
 */
async function getAllFiles(dir: string, patterns: string[]): Promise<string[]> {
    // Convert patterns to be relative to the source directory
    const fullPatterns = patterns.map(pattern => path.join(dir, pattern))

    // Use the existing utilities to expand file patterns and filter ignored paths
    const allFiles = await expandFilePatterns(fullPatterns)
    return filterIgnoredPaths(allFiles)
}

// Command-line interface
if (require.main === module) {
    const args = process.argv.slice(2)

    if (args.length < 2) {
        console.error(
            'Usage: bun mirror-index.ts <sourceDir> <targetDir> [--verbose] [--patterns=<comma-separated-patterns>]',
        )
        process.exit(1)
    }

    const sourceDir = args[0]
    const targetDir = args[1]
    const verbose = args.includes('--verbose')

    // Parse patterns from command line
    const patternsArg = args.find(arg => arg.startsWith('--patterns='))
    const filePatterns = patternsArg ? patternsArg.replace('--patterns=', '').split(',') : ['**/*']

    mirrorIndexedFiles(sourceDir, targetDir, { filePatterns, verbose })
        .then(() => {
            console.log(`Successfully mirrored indexed files from ${sourceDir} to ${targetDir}`)
        })
        .catch(err => {
            console.error('Error mirroring indexed files:', err)
            process.exit(1)
        })
}
