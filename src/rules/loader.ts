import path from 'path'
import { parse } from 'yaml'
import { findTool } from '../tools/tools'
import { expandFilePatterns } from '../util/fs/glob'
import { safeReadFile } from '../util/fs/safe'
import { xdgConfigHome } from '../util/fs/xdgconfig'
import { Rule } from './types'

export async function getRules(): Promise<Rule[]> {
    return Promise.all((await expandFilePatterns(rulesGlobs())).map(parseRuleFile))
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

async function parseRuleFile(path: string): Promise<Rule> {
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(await safeReadFile(path))
    if (!match) {
        throw new Error(`Malformed rule "${path}": no YAML frontmatter`)
    }

    const [_, frontMatter, body] = match
    const metadata = parse(frontMatter)

    if (typeof metadata.description !== 'string') {
        throw new Error('Rule must have a description string')
    }
    if (typeof metadata.tool !== 'string') {
        throw new Error('Malformed rule "${path}": rule must have a tool string')
    }
    if (metadata.timing !== 'pre' && metadata.timing !== 'post') {
        throw new Error('Malformed rule "${path}": rule timing must be either "pre" or "post"')
    }

    const tool = findTool(metadata.tool)

    if (!tool.ruleMatcherFactory) {
        throw new Error(`Malformed rule "${path}": tool "${metadata.tool}" does not have a ruleMatcher`)
    }

    return {
        description: metadata.description,
        tool: metadata.tool,
        timing: metadata.timing,
        matcher: tool.ruleMatcherFactory.parseMatchConfig(metadata),
        body: body.trim(),
    }
}
