import chalk from 'chalk'
import ora from 'ora'

export type Updater<T> = (snapshot?: T, error?: Error) => void
export type Formatter<T> = (snapshot?: T, error?: Error) => string
export type ProgressSubject<T> = (update: Updater<T>) => Promise<T>
export type ProgressResult<T> = { ok: false; snapshot?: T; error: Error } | { ok: true; response: T }

export type ProgressOptions<T> = {
    progress: Formatter<T>
    success: Formatter<T>
    failure: Formatter<T>
}

export async function withProgress<T>(f: ProgressSubject<T>, options: ProgressOptions<T>): Promise<ProgressResult<T>> {
    const spinner = ora({
        text: options.progress(undefined),
        discardStdin: false,
    })

    let snapshot: T | undefined
    spinner.start()

    try {
        const response = await f(latest => {
            snapshot = latest
            spinner.text = options.progress(snapshot)
        })

        spinner.succeed(options.success(snapshot))
        return { ok: true, response }
    } catch (error: any) {
        spinner.fail(options.failure(snapshot, error))
        return { ok: false, snapshot, error }
    } finally {
        console.log()
    }
}

export function prefixFormatter<T>(prefix: string, serialize: (snapshot?: T) => string): Formatter<T> {
    return (snapshot?: T, error?: Error) => {
        let content = serialize(snapshot)

        if (error) {
            if (content) {
                content += '\n\n'
            }
            content += chalk.bold.red(`error: ${error.message}`)
        }

        if (!content) {
            return prefix
        }

        return prefix + '\n\n' + content
    }
}
