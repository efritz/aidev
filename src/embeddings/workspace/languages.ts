import { readFile } from 'fs/promises'
import path from 'path'
import Parser from 'tree-sitter'
import Go from 'tree-sitter-go'
import TypeScript from 'tree-sitter-typescript'
import { parse } from 'yaml'

export type LanguageConfiguration = {
    name: string
    queries: Map<string, string>
    language: Parser.Language
}

const repoRoot = path.join(__dirname, '..', '..', '..')
const queriesPath = path.join(repoRoot, 'configs', 'languages.yaml')

export const treesitterLanguages = {
    go: { language: Go, extensions: ['.go'] },
    typescript: { language: TypeScript.typescript, extensions: ['.ts', '.js', '.tsx', '.jsx'] },
}

export type SupportedLanguage = keyof typeof treesitterLanguages

export async function readLanguageConfiguration(laguageName: SupportedLanguage): Promise<LanguageConfiguration> {
    const languageConfig = (await readLanguageConfigurations()).get(laguageName)
    if (!languageConfig) {
        throw new Error(`Unsupported language (no configuration): ${laguageName}`)
    }

    return languageConfig
}

type rawLanguageConfig = {
    name: string
    queries: {
        [key: string]: string
    }
}

export async function readLanguageConfigurations(): Promise<Map<string, LanguageConfiguration>> {
    const { languages } = parse(await readFile(queriesPath, 'utf-8')) as {
        languages: rawLanguageConfig[]
    }

    const configurations = new Map()
    for (const language of languages) {
        if (!Object.keys(treesitterLanguages).includes(language.name)) {
            throw new Error(`Unsupported language (no treesitter grammar): ${language.name}`)
        }

        configurations.set(language.name, {
            name: language.name,
            queries: new Map(Object.entries(language.queries)),
            language: treesitterLanguages[language.name as SupportedLanguage].language,
        })
    }

    return configurations
}
