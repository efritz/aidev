import { readFile } from 'fs/promises'
import { parse } from 'yaml'

export interface FrontmatterResult<T = any> {
    frontmatter: T
    content: string
}

export async function loadMarkdownWithFrontmatter<T = any>(filePath: string): Promise<FrontmatterResult<T>> {
    const fileContent = await readFile(filePath, 'utf-8')
    return parseMarkdownWithFrontmatter<T>(fileContent)
}

export function parseMarkdownWithFrontmatter<T = any>(content: string): FrontmatterResult<T> {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
    const match = content.match(frontmatterRegex)

    if (!match) {
        return {
            frontmatter: {} as T,
            content: content.trim(),
        }
    }

    const [, frontmatterYaml, markdownContent] = match

    return {
        frontmatter: parse(frontmatterYaml) as T,
        content: markdownContent.trim(),
    }
}
