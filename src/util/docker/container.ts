import { execSync, spawn } from 'child_process'
import path from 'path'
import chalk from 'chalk'

export class DockerContainer {
    private containerId?: string
    private readonly imageName = 'alpine'
    private readonly workspaceMount: string

    constructor() {
        this.workspaceMount = process.cwd()
    }

    async start(): Promise<void> {
        if (this.containerId) {
            throw new Error('Container is already running')
        }

        console.log(chalk.dim('ℹ') + ' Starting Docker container...')

        try {
            // Pull the alpine image if not present
            execSync('docker image inspect alpine > /dev/null 2>&1 || docker pull alpine', {
                stdio: 'pipe',
            })

            // Start the container
            const result = execSync(
                `docker run -d -v "${this.workspaceMount}:/workspace" -w /workspace ${this.imageName} tail -f /dev/null`,
                { encoding: 'utf8' }
            )

            this.containerId = result.trim()
            console.log(chalk.green('✓') + ' Docker container started')
        } catch (error: any) {
            throw new Error(`Failed to start Docker container: ${error.message}`)
        }
    }

    async stop(): Promise<void> {
        if (!this.containerId) {
            return
        }

        console.log(chalk.dim('ℹ') + ' Stopping Docker container...')

        try {
            execSync(`docker stop ${this.containerId}`, { stdio: 'pipe' })
            execSync(`docker rm ${this.containerId}`, { stdio: 'pipe' })
            console.log(chalk.green('✓') + ' Docker container stopped and removed')
        } catch (error: any) {
            console.warn(chalk.yellow('⚠') + ` Failed to clean up container: ${error.message}`)
        } finally {
            this.containerId = undefined
        }
    }

    async exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        if (!this.containerId) {
            throw new Error('Container is not running')
        }

        return new Promise((resolve, reject) => {
            const child = spawn('docker', ['exec', this.containerId!, 'sh', '-c', command], {
                stdio: 'pipe',
            })

            let stdout = ''
            let stderr = ''

            child.stdout?.on('data', (data) => {
                stdout += data.toString()
            })

            child.stderr?.on('data', (data) => {
                stderr += data.toString()
            })

            child.on('close', (exitCode) => {
                resolve({ stdout, stderr, exitCode: exitCode ?? 0 })
            })

            child.on('error', (error) => {
                reject(error)
            })
        })
    }

    isRunning(): boolean {
        return !!this.containerId
    }

    getContainerId(): string | undefined {
        return this.containerId
    }
}