import path from 'path'
import { parse } from 'yaml'
import { findTool } from '../tools/tools'
import { expandFilePatterns } from '../util/fs/glob'
import { safeReadFile } from '../util/fs/safe'
import { xdgConfigHome } from '../util/fs/xdgconfig'
import { Rule } from './types'

export async function getRules(): Promise<Rule[]> {
    return (await Promise.all((await expandFilePatterns(rulesGlobs())).map(parseRuleFile))).flat()
}

function rulesGlobs(): string[] {
    return rulesDirs().map(base => path.join(base, '*.md'))
}

function rulesDirs(): string[] {
    return ['.aidev', configDir()].map(base => path.join(base, 'rules'))
}

function configDir(): string {
    return path.join(xdgConfigHome(), 'aidev')
}

async function parseRuleFile(path: string): Promise<Rule[]> {
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(await safeReadFile(path))
    if (!match) {
        throw new Error(`Malformed rule "${path}": no YAML frontmatter`)
    }

    const [_, frontMatter, body] = match
    const metadata = parse(frontMatter)
    const toolNames = Array.isArray(metadata.tool) ? metadata.tool : [metadata.tool]

    const rules = []
    for (const toolName of toolNames) {
        if (typeof metadata.description !== 'string') {
            throw new Error('Rule must have a description string')
        }
        if (typeof toolName !== 'string') {
            throw new Error('Malformed rule "${path}": rule must have a tool string')
        }
        if (metadata.timing !== 'pre' && metadata.timing !== 'post') {
            throw new Error('Malformed rule "${path}": rule timing must be either "pre" or "post"')
        }

        const tool = findTool(toolName)

        if (!tool.ruleMatcherFactory) {
            throw new Error(`Malformed rule "${path}": tool "${toolName}" does not have a ruleMatcher`)
        }

        rules.push({
            description: metadata.description,
            tool: metadata.tool,
            timing: metadata.timing,
            matcher: tool.ruleMatcherFactory.parseMatchConfig(metadata),
            body: body.trim(),
        })
    }

    return rules
}
