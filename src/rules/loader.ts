import path from 'path'
import { parse } from 'yaml'
import { z } from 'zod'
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

const RuleMetadataSchema = z
    .object({
        description: z.string().describe('Rule description.'),
        tool: z.union([z.string(), z.array(z.string())]).describe('Tool name or array of tool names.'),
        timing: z.enum(['pre', 'post']).describe('Rule timing - either "pre" or "post".'),
    })
    .passthrough()

type RuleMetadata = z.infer<typeof RuleMetadataSchema>

async function parseRuleFile(filePath: string): Promise<Rule[]> {
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(await safeReadFile(filePath))
    if (!match) {
        throw new Error(`Malformed rule "${filePath}": no YAML frontmatter`)
    }

    const [_, frontMatter, body] = match
    const rawMetadata = parse(frontMatter)

    let metadata: RuleMetadata
    try {
        metadata = RuleMetadataSchema.parse(rawMetadata)
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')
            throw new Error(`Malformed rule "${filePath}": ${issues}`)
        }

        throw error
    }

    const toolNames = Array.isArray(metadata.tool) ? metadata.tool : [metadata.tool]

    const rules = []
    for (const toolName of toolNames) {
        const tool = findTool(toolName)

        if (!tool.ruleMatcherFactory) {
            throw new Error(`Malformed rule "${filePath}": tool "${toolName}" does not have a ruleMatcher`)
        }

        rules.push({
            description: metadata.description,
            tool: toolName,
            timing: metadata.timing,
            matcher: tool.ruleMatcherFactory.parseMatchConfig(metadata),
            body: body.trim(),
        })
    }

    return rules
}
