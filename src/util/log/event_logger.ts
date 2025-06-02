import { appendFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

export function createEventLogger(envVarName: string): { logEvent: (event: unknown) => void } {
    const logFile = process.env[envVarName]
    if (!logFile) {
        return {
            logEvent: () => {},
        }
    }

    mkdirSync(dirname(logFile), { recursive: true })

    return {
        logEvent: (event: unknown): void => {
            const logEntry = {
                timestamp: new Date().toISOString(),
                event,
            }

            appendFileSync(logFile, JSON.stringify(logEntry) + '\n')
        },
    }
}
