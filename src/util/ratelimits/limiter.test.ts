import { createLimiter } from './limiter'

describe('limiter', async () => {
    it('should limit concurrent calls', async () => {
        const numTasks = 1000
        const maxConcurrent = 20
        const limiter = createLimiter()
        limiter.setConfig({ name: 'test', maxConcurrent })

        let active = 0
        let maxActive = 0

        const wrapped = limiter.wrap('test', async () => {
            active++
            maxActive = Math.max(maxActive, active)
            await new Promise(resolve => setTimeout(resolve, 10))
            active--
        })

        await Promise.all(new Array(numTasks).fill(null).map(() => wrapped()))
        expect(maxActive).toBeLessThanOrEqual(maxConcurrent)
    })

    it('should limit rate', async () => {
        const numTasks = 10
        const maxPerSecond = 5
        const epsilonMs = 50
        const limiter = createLimiter()
        limiter.setConfig({ name: 'test', maxPerSecond })

        const logs: { id: number; startTime: number }[] = []

        const wrapped = limiter.wrap('test', async id => {
            logs.push({ id, startTime: performance.now() })
            await new Promise(resolve => setTimeout(resolve, 10))
        })

        await Promise.all(new Array(numTasks).fill(null).map((_, i) => wrapped(i + 1)))

        const startTimes = logs.map(({ startTime }) => startTime)
        const startTimeDeltas = startTimes.map((startTime, i) => (i === 0 ? 0 : startTime - startTimes[i - 1]))

        // Ensure tasks finish in order
        expect(logs.map(({ id }) => id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

        // Initial burst - all first `maxPerSecond` task should all happen at once
        expect(startTimeDeltas.slice(0, maxPerSecond).reduce((acc, delta) => acc + delta, 0)).toBeLessThan(epsilonMs)

        // After the initial burst, each additional task should only be invoked once a token is available
        expect(Math.min(...startTimeDeltas.slice(maxPerSecond))).toBeGreaterThanOrEqual(1000 / maxPerSecond - epsilonMs)
    })
})
