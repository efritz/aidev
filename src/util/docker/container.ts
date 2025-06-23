import chalk from 'chalk'
import { ExecContext, execOnHost } from '../shell/exec'

export type Container = Awaited<ReturnType<typeof startContainer>>

export async function startContainer(context: ExecContext, containerImage: string) {
    console.log(`${chalk.dim('ℹ')} Starting Docker container from ${containerImage}...`)

    let containerId = ''
    try {
        const output = await execOnHost(
            context,
            `docker run -d -v "${process.cwd()}:/workspace" -w /workspace ${containerImage} tail -f /dev/null`,
        )

        for (const line of output) {
            containerId = line.content.trim()
        }

        console.log(`${chalk.green('✓')} Docker container ${containerId} started`)
    } catch (error: any) {
        throw new Error(`Failed to start Docker container: ${error.message}`)
    }

    const stop = async () => {
        console.log(`${chalk.dim('ℹ')} Stopping Docker container...`)

        try {
            await execOnHost(context, `docker stop ${containerId}`)
            await execOnHost(context, `docker rm ${containerId}`)
            console.log(`${chalk.green('✓')} Docker container stopped and removed`)
        } catch (error: any) {
            console.warn(`${chalk.yellow('⚠')} Failed to clean up container: ${error.message}`)
        }
    }

    return {
        containerId: () => containerId,
        stop,
    }
}
