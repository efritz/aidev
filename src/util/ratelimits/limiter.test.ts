import { createLimiter } from './limiter'

describe('foo', async () => {
    const limiter = createLimiter()
    limiter.setConfig({ name: 'test', maxConcurrent: 2 })

    const perf: { id: number; start: number; end: number }[] = []

    const f = limiter.wrap('test', async (id: number) => {
        console.log('start', { id })
        const start = performance.now()
        const r = Math.random() * 2000 + 500
        await new Promise(resolve => setTimeout(resolve, r))
        const end = performance.now()
        console.log('done', { id })
        perf.push({ id, start, end })
    })

    const ps: Promise<void>[] = []
    for (let i = 0; i < 10; i++) {
        ps.push(f(i))
    }

    await Promise.all(ps)
    console.log(perf)
})
