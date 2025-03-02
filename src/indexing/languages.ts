import path from 'path'
import Parser, { Query } from 'tree-sitter'
import Go from 'tree-sitter-go'
import TypeScript from 'tree-sitter-typescript'
import { z } from 'zod'
import { loadYamlFromFile } from '../util/yaml/load'

export type LanguageConfiguration = {
    name: string
    extensions: string[]
    parser: Parser
    queries: Map<string, Parser.Query>
}

let parsers: Promise<LanguageConfiguration[]> | undefined = undefined

export function createParsers(): Promise<LanguageConfiguration[]> {
    if (!parsers) {
        parsers = createParsersUncached()
    }

    return parsers
}

const treesitterLanguages = {
    go: Go as Parser.Language,
    typescript: TypeScript.typescript as Parser.Language,
}

async function createParsersUncached(): Promise<LanguageConfiguration[]> {
    const { languages } = await readLanguageConfigurations()

    return languages.map(({ name, extensions, queries: queryTexts }) => {
        if (!Object.keys(treesitterLanguages).includes(name)) {
            throw new Error(`Unsupported language (no treesitter grammar): ${name}`)
        }

        const language = treesitterLanguages[name as keyof typeof treesitterLanguages]

        const parser = new Parser()
        parser.setLanguage(language)

        return {
            name,
            extensions,
            parser,
            queries: new Map(Object.entries(queryTexts).map(([type, query]) => [type, new Query(language, query)])),
        }
    })
}

const repoRoot = path.join(__dirname, '..', '..')
const queriesPath = path.join(repoRoot, 'configs', 'languages.yaml')

const LanguagesConfigSchema = z.object({
    languages: z.array(
        z.object({
            name: z.enum(Object.keys(treesitterLanguages) as [string, ...string[]]),
            extensions: z.array(z.string()),
            queries: z.record(z.string()),
        }),
    ),
})

type LanguagesConfig = z.infer<typeof LanguagesConfigSchema>

async function readLanguageConfigurations(): Promise<LanguagesConfig> {
    return LanguagesConfigSchema.parse(await loadYamlFromFile(queriesPath))
}
