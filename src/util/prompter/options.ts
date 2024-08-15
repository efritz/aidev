import chalk from 'chalk'
import { Questioner } from './questions'

export interface Optioner {
    choice: (prompt: string, options: ChoiceOption[]) => Promise<string>
    options: <T>(prompt: string, options: PromptOption<T>[]) => Promise<T>
}

export interface ChoiceOption {
    name: string
    description: string
    isDefault?: boolean
}

export interface PromptOption<T> extends ChoiceOption {
    handler: () => Promise<T>
}

export function createOptioner(questioner: Questioner): Optioner {
    const options = async <T>(prompt: string, opts: PromptOption<T>[]): Promise<T> => {
        const helpOption = { name: '?', description: 'print help', isDefault: false }
        const allOptions = [...opts, helpOption]

        const normalizedOptions = allOptions.map(({ name, ...rest }) => ({
            name: rest.isDefault ? name.toUpperCase() : name.toLowerCase(),
            ...rest,
        }))

        const optionNames = normalizedOptions.map(({ name }) => name)
        const formattedPrompt = `${prompt} [${optionNames.join('/')}]? `
        const colorizedPrompt = chalk.cyanBright(formattedPrompt)

        const helpText = normalizedOptions.map(({ name, description }) => `${name} - ${description}`).join('\n')
        const colorizedHelpText = chalk.bold.red(helpText)

        while (true) {
            const value = await questioner.question(colorizedPrompt)

            const option = opts.find(
                ({ isDefault, name }) =>
                    (value === '' && isDefault) || (value !== '' && name.toLowerCase() === value[0].toLowerCase()),
            )
            if (option) {
                return option.handler()
            }

            console.log(colorizedHelpText)
        }
    }

    const choice = (prompt: string, opts: ChoiceOption[]): Promise<string> => {
        return options(
            prompt,
            opts.map(({ name, description, isDefault }) => ({
                name,
                description,
                isDefault,
                handler: async () => name,
            })),
        )
    }

    return { choice, options }
}
