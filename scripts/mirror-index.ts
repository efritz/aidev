import fs from 'fs/promises'
import path from 'path'
import { program } from 'commander'
import { getScopePath, splitSourceCode } from '../src/indexing/code'
import { createParsers, LanguageConfiguration } from '../src/indexing/languages'
import { expandFilePatterns } from '../src/util/fs/glob'
import { filterIgnoredPaths } from '../src/util/fs/ignore'

async function main() {
    const verboseFlags = '-v, --verbose'
    const verboseDescription = 'Enable verbose logging'

    const patternsFlags = '-p, --patterns <string>'
    const patternsDescription = 'Comma-separated glob patterns for files to include'

    program
        .name('mirror-index')
        .description('Mirror indexed files with code block annotations')
        .argument('<sourceDir>', 'Source directory containing files to process')
        .argument('<targetDir>', 'Target directory where processed files will be written')
        .option(verboseFlags, verboseDescription, false)
        .option(patternsFlags, patternsDescription, '**/*')
        .action(async (sourceDir, targetDir, options) => {
            const filePatterns = options.patterns.split(',')
            const verbose = options.verbose

            try {
                await mirrorIndexedFiles(sourceDir, targetDir, filePatterns, verbose)
                console.log(`Successfully mirrored indexed files from ${sourceDir} to ${targetDir}`)
            } catch (err) {
                console.error('Error mirroring indexed files:', err)
                process.exit(1)
            }
        })

    program.parse()
}

async function mirrorIndexedFiles(
    sourceDir: string,
    targetDir: string,
    filePatterns: string[],
    verbose: boolean,
): Promise<void> {
    const parsers = await createParsers()

    const files = await filterIgnoredPaths(
        await expandFilePatterns(filePatterns.map(pattern => path.join(sourceDir, pattern))),
    )
    if (verbose) {
        console.log(`Found ${files.length} files to process`)
    }

    for (const file of files) {
        const content = await fs.readFile(file, 'utf-8')
        const relativePath = path.relative(sourceDir, file)
        const targetPath = path.join(targetDir, relativePath)

        const parser = parsers.find(parser => parser.extensions.some(ext => file.endsWith(ext)))
        const outputContent = parser ? await annotateContentWithBlockBoundaries(content, parser) : content

        if (verbose) {
            console.log(`Writing ${relativePath}`)
        }

        await writeFile(targetPath, outputContent)
    }
}

async function annotateContentWithBlockBoundaries(content: string, parser: LanguageConfiguration): Promise<string> {
    const startMarkers = new Map<number, string[]>()
    const endMarkers = new Map<number, string[]>()

    for (const block of await splitSourceCode(content, parser)) {
        const scopePath = getScopePath(block)
        const name = scopePath ? scopePath + '.' + block.name : block.name
        const startLine = block.startLine - 1
        const endLine = block.endLine

        const startMarker = `// #region CHUNK (${block.type}): ${name}`
        startMarkers.set(startLine, (startMarkers.get(startLine) ?? []).concat(startMarker))

        const endMarker = `// #endregion CHUNK (${block.type}): ${name}`
        endMarkers.set(endLine, (endMarkers.get(endLine) ?? []).concat(endMarker))
    }

    const lines = content.split('\n')
    const output: string[] = []

    for (let i = 0; i < lines.length; i++) {
        output.push(...(endMarkers.get(i) ?? []))
        output.push(...(startMarkers.get(i) ?? []))
        output.push(lines[i])
    }

    const lastLine = lines.length
    output.push(...(endMarkers.get(lastLine) ?? []))
    output.push(...(startMarkers.get(lastLine) ?? []))

    return output.join('\n')
}

async function writeFile(targetPath: string, content: string) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, content)
}

main()
