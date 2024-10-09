import { invertPromise } from './promise'

describe('invertPromise', () => {
    it('should resolve the promise when resolve is called', async () => {
        const { promise, resolve } = invertPromise<string>()
        resolve('test value')
        await expect(promise).resolves.toBe('test value')
    })

    it('should reject the promise when reject is called', async () => {
        const { promise, reject } = invertPromise<string>()
        reject(new Error('test error'))
        await expect(promise).rejects.toThrow('test error')
    })
})
