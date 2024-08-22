const { build } = require('esbuild')

const commonConfig = {
    bundle: true,
    platform: 'node',
    external: ['vscode', 'fsevents'],
}

const configs = [
    {
        ...commonConfig,
        entryPoints: ['src/main.ts'],
        outfile: 'dist/main.mjs',
        format: 'esm',
        banner: {
            js: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
        },
    },
    {
        ...commonConfig,
        entryPoints: ['src/extension.ts'],
        outfile: 'dist/extension.js',
        format: 'cjs',
    },
]

;(async () => {
    try {
        await Promise.all(configs.map(config => build(config)))
        console.log('Build completed successfully')
    } catch (error) {
        console.error('Build failed:', error)
        process.exit(1)
    }
})()
