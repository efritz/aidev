import { spawn } from 'child_process'
import { mkdirSync, readdirSync, rmdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { describe, expect, it } from 'bun:test'
import { safeReadFile } from '../util/fs/safe'

describe('mirror-index script', () => {
    const goldenDir = path.join(__dirname, 'golden')
    const sourceDir = path.join(__dirname, 'testdata')
    const targetDir = path.join(os.tmpdir(), 'aidev-test-data-' + Date.now())

    it('generates expected output matching golden files', async () => {
        if (process.env['UPDATE_GOLDEN'] === 'true') {
            console.log('Updating golden files...')
            await runMirrorIndexScript(sourceDir, goldenDir)
            console.log('Golden files updated successfully')
            return
        }

        mkdirSync(targetDir, { recursive: true })

        try {
            await runMirrorIndexScript(sourceDir, targetDir)

            for (const testFile of readdirSync(sourceDir)) {
                const targetFile = path.join(targetDir, testFile)
                const goldenFile = path.join(goldenDir, testFile)

                expect(await safeReadFile(targetFile)).toBe(await safeReadFile(goldenFile))
            }
        } finally {
            rmdirSync(targetDir, { recursive: true })
        }
    })
})

async function runMirrorIndexScript(sourceDir: string, targetDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'mirror-index.ts')

        console.log([scriptPath, sourceDir, targetDir])
        const child = spawn('bun', [scriptPath, sourceDir, targetDir], {
            stdio: 'pipe',
            cwd: path.join(__dirname, '..', '..'),
        })

        let stdout = ''
        child.stdout?.on('data', data => {
            stdout += data.toString()
        })

        let stderr = ''
        child.stderr?.on('data', data => {
            stderr += data.toString()
        })

        child.on('close', code => {
            if (code === 0) {
                resolve()
            } else {
                reject(new Error(`mirror-index script failed with code ${code}\nstdout: ${stdout}\nstderr: ${stderr}`))
            }
        })

        child.on('error', reject)
    })
}
