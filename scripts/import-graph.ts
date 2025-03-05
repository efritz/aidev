import * as fs from 'fs'
import * as path from 'path'
import { glob } from 'glob'
import * as ts from 'typescript'

const displayDirectories = false

function processFile(filePath: string, importGraph: Map<string, Set<string>>): void {
    const sourceDir = filePath
    const sourceText = fs.readFileSync(filePath, 'utf-8')
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true)

    sourceFile.forEachChild(node => {
        if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            const importPath = node.moduleSpecifier.text

            if (importPath.startsWith('.')) {
                let resolvedPath = path.resolve(path.dirname(filePath), importPath)
                if (fs.existsSync(`${resolvedPath}.ts`)) {
                    resolvedPath = `${resolvedPath}.ts`
                }

                let importedDir = resolvedPath

                if (!importGraph.has(sourceDir)) {
                    importGraph.set(sourceDir, new Set<string>())
                }
                importGraph.get(sourceDir)!.add(importedDir)
            }
        }
    })
}

function removePackagesDistinctFromTarget(
    importGraph: Map<string, Set<string>>,
    packageName: string,
): Map<string, Set<string>> {
    if (!packageName) {
        return importGraph
    }

    const filtered = new Map()
    for (const [sourceFile, targetFiles] of importGraph.entries()) {
        if (getFile(sourceFile).startsWith(packageName)) {
            filtered.set(sourceFile, targetFiles)
        } else {
            const matchingTargetFiles = [...targetFiles].filter(file => getFile(file).startsWith(packageName))
            if (matchingTargetFiles.length > 0) {
                filtered.set(sourceFile, matchingTargetFiles)
            }
        }
    }

    return filtered
}

function generateDotFile(importGraph: Map<string, Set<string>>): void {
    const allDirectories = new Set<string>()
    for (const [sourceDir, targetDirs] of importGraph.entries()) {
        allDirectories.add(getDirectory(sourceDir))
        targetDirs.forEach(targetDir => allDirectories.add(getDirectory(targetDir)))
    }

    const parents = new Map<string, string>()
    for (let dir of allDirectories) {
        while (dir !== '.') {
            const parent = path.dirname(dir)
            parents.set(dir, parent)
            allDirectories.add(parent)
            dir = parent
        }
    }

    const children = new Map<string, Set<string>>()
    for (let dir of allDirectories) {
        children.set(dir, new Set<string>())
    }

    for (let dir of allDirectories) {
        if (dir === '.') {
            continue
        }
        children.get(parents.get(dir)!)!.add(dir)
    }

    const allFiles = new Set<string>()
    for (const [sourceFile, targetFiles] of importGraph.entries()) {
        allFiles.add(getFile(sourceFile))
        targetFiles.forEach(targetDir => allFiles.add(getFile(targetDir)))
    }

    console.log('digraph DirectoryImports {')
    console.log('  rankdir=TB;')
    console.log('  compound=true;')
    console.log('  splines=ortho;')
    console.log('  node [shape=box, style=filled, fillcolor=lightblue];\n')

    const handled = new Set<string>()

    const handle = (dir: string): void => {
        if (handled.has(dir)) {
            return
        }

        console.log(`subgraph cluster_${dir.replace(/\//g, '_').replace(/\./, 'src')} {`)
        console.log(`  label="${dir === '.' ? 'src' : path.basename(dir)}";`)
        console.log('  color=lightgrey;')
        console.log('  node [style=filled, fillcolor=lightblue];\n')

        for (const file of [...allFiles].sort()) {
            if (path.dirname(file) === dir) {
                console.log(`  "${file.replace(/\//g, '_')}" [label="${path.basename(file)}"];`)
            }
        }

        for (const child of children.get(dir)!) {
            handle(child)
        }

        console.log('}')
        console.log()
        handled.add(dir)
    }

    for (const dir of [...allDirectories].sort()) {
        handle(dir)
    }

    const links: Map<string, Set<string>> = new Map()
    for (const [sourceFile, targetFiles] of importGraph.entries()) {
        const source = getFile(sourceFile).replace(/\//g, '_')
        const sourceLinks = links.get(source) ?? new Set<string>()

        for (const targetFile of targetFiles) {
            sourceLinks.add(getFile(targetFile).replace(/\//g, '_'))
        }

        links.set(source, sourceLinks)
    }

    for (const [source, targets] of links.entries()) {
        for (const target of targets) {
            if (source != target) {
                console.log(`"${source}" -> "${target}";`)
            }
        }
    }

    console.log('}')
}

function getDirectory(filePath: string): string {
    return path.relative(path.resolve('./src'), path.dirname(filePath)) || '.'
}

function getFile(filePath: string): string {
    return displayDirectories ? getDirectory(filePath) : path.relative(path.resolve('./src'), filePath)
}

//
//

function checkCycles(importGraph: Map<string, Set<string>>): void {
    const visited = new Set<string>()
    const stack = new Set<string>()
    const cycles: string[][] = []
    const cycleNodes = new Set<string>()

    const visit = (node: string, path: string[]): void => {
        if (stack.has(node)) {
            const cycleStartIndex = path.indexOf(node)
            if (cycleStartIndex !== -1) {
                cycles.push(path.slice(cycleStartIndex))
            }
            return
        }

        if (visited.has(node)) {
            return
        }

        visited.add(node)
        stack.add(node)

        const neighbors = importGraph.get(node) || []
        for (const neighbor of neighbors) {
            visit(neighbor, [...path, neighbor])
        }

        stack.delete(node)
    }

    for (const node of importGraph.keys()) {
        visit(node, [node])
    }

    for (const cycle of cycles) {
        cycle.forEach(node => cycleNodes.add(node))
    }
    if (cycleNodes.size > 0) {
        process.stderr.write('Found cycles in the import graph:\n\n')

        for (const cycle of cycles) {
            process.stderr.write(`  ${cycle.map(node => getFile(node)).join('\n\t -> ')}\n\n`)
        }
    }
}

async function main(): Promise<void> {
    const files = await glob('src/**/*.ts', { absolute: true })
    const importGraph = new Map<string, Set<string>>()
    files.forEach(path => processFile(path, importGraph))
    checkCycles(importGraph)
    generateDotFile(removePackagesDistinctFromTarget(importGraph, process.argv[2]))
}

main()
