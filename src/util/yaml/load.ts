import { readFile } from 'fs/promises'
import path from 'path'
import { parse } from 'yaml'
import { merge } from './merge'

export async function loadYamlFromFile(filePath: string, basePath?: string): Promise<any> {
    return processIncludes(parse(await readFile(filePath, 'utf-8')), basePath ?? path.dirname(filePath))
}

async function processIncludes(obj: any, baseDir: string): Promise<any> {
    return obj && typeof obj === 'object' && 'include' in obj
        ? processIncludeDirectives(obj, baseDir)
        : processNestedIncludeDirectives(obj, baseDir)
}

async function processIncludeDirectives<T extends object>(
    { include, ...rest }: T & { include: any },
    baseDir: string,
): Promise<any> {
    let result: any = rest

    for (const includePath of Array.isArray(include) ? include : [include]) {
        if (typeof includePath !== 'string') {
            throw new Error(`Invalid include path: "${includePath}"`)
        }

        const resolvedPath = path.isAbsolute(includePath) ? includePath : path.resolve(baseDir, includePath)
        const included = await loadYamlFromFile(resolvedPath, path.dirname(resolvedPath))
        result = merge(result, included)
    }

    return processNestedIncludeDirectives(result, baseDir)
}

async function processNestedIncludeDirectives(result: any, baseDir: string): Promise<any> {
    if (result && typeof result === 'object') {
        if (Array.isArray(result)) {
            return Promise.all(result.map(item => processIncludes(item, baseDir)))
        }

        for (const [key, value] of Object.entries(result)) {
            result[key] = await processIncludes(value, baseDir)
        }
    }

    return result
}
