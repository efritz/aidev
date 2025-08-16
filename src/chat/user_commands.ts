import { readdir } from 'fs/promises'
import path from 'path'
import { z } from 'zod'
import { exists } from '../util/fs/safe'
import { xdgConfigHome } from '../util/fs/xdgconfig'
import { loadMarkdownWithFrontmatter } from '../util/yaml/frontmatter'

const UserCommandArgSchema = z.object({
    name: z.string(),
    description: z.string(),
})

const UserCommandSchema = z.object({
    description: z.string(),
    args: z.array(UserCommandArgSchema),
    template: z.string(),
})

export type UserCommandArg = z.infer<typeof UserCommandArgSchema>
export type UserCommand = z.infer<typeof UserCommandSchema>

export async function loadUserCommands(): Promise<Record<string, UserCommand>> {
    const globalCommands = await loadUserCommandsFromDirectory(globalCommandsDirectory())
    const repoCommands = await loadUserCommandsFromDirectory(repoCommandsDirectory())

    // Repository commands override global commands
    return { ...globalCommands, ...repoCommands }
}

async function loadUserCommandsFromDirectory(dirPath: string): Promise<Record<string, UserCommand>> {
    if (!(await exists(dirPath))) {
        return {}
    }

    try {
        const files = await readdir(dirPath)
        const commands: Record<string, UserCommand> = {}

        for (const file of files) {
            if (!file.endsWith('.md')) {
                continue
            }

            const commandName = path.basename(file, '.md')
            const filePath = path.join(dirPath, file)

            try {
                const { frontmatter, content } = await loadMarkdownWithFrontmatter(filePath)
                const parsedCommand = UserCommandSchema.parse({
                    ...frontmatter,
                    template: content,
                })
                commands[commandName] = parsedCommand
            } catch (error) {
                console.error(`Error loading user command from ${filePath}:`, error)
            }
        }

        return commands
    } catch (error) {
        console.error(`Error loading user commands from ${dirPath}:`, error)
        return {}
    }
}

function globalCommandsDirectory(): string {
    return path.join(xdgConfigHome(), 'aidev', 'commands')
}

function repoCommandsDirectory(): string {
    return path.join('.aidev', 'commands')
}
