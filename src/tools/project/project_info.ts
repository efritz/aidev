import { existsSync, readFileSync } from 'fs'
import chalk from 'chalk'
import { parse as parseYaml } from 'yaml'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

type ProjectInfoResult =
    | { exists: false }
    | {
          exists: true
          manifest: any
      }

const manifestPath = 'aidev.yaml'

export const projectInfo: Tool = {
    name: 'project_info',
    description: 'Read the aidev.yaml file if it exists and return its contents as structured data.',
    parameters: {
        type: JSONSchemaDataType.Object,
        description: 'The command payload.',
        properties: {},
        required: [],
    },
    execute: async (context: ExecutionContext, args: Arguments): Promise<ExecutionResult> => {
        if (!existsSync(manifestPath)) {
            console.log(chalk.yellow(`${chalk.dim('ℹ')} Warning: aidev.yaml does not exist in the current directory.`))
            console.log(
                chalk.yellow(`Hint: Create an aidev.yaml file to define project-specific settings and metadata.`),
            )
            console.log()

            return { result: { exists: false } }
        }

        const manifest = parseYaml(readFileSync(manifestPath, 'utf-8'))
        console.log(`${chalk.green('✔')} Read project manifest.`)
        console.log()

        return { result: { exists: true, manifest }, reprompt: true }
    },
    replay: (args: Arguments, { result, error }: ToolResult) => {
        if (error) {
            console.log(`${chalk.red('✖')} Failed to read project manifest.`)
            console.log()
            return
        }

        const projectInfoResult = result as ProjectInfoResult

        if (projectInfoResult.exists) {
            console.log(`${chalk.green('✔')} Read project manifest.`)
            console.log()
        } else {
            console.log(chalk.yellow(`${chalk.dim('ℹ')} Warning: aidev.yaml does not exist in the current directory.`))
            console.log(
                chalk.yellow(`Hint: Create an aidev.yaml file to define project-specific settings and metadata.`),
            )
            console.log()
        }
    },
    serialize: (result?: any) => {
        return JSON.stringify(result as ProjectInfoResult)
    },
}
