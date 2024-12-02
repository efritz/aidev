const { build } = require('esbuild')

const commonConfig = {
    bundle: true,
    platform: 'node',
    target: 'node18',
    external: ['vscode', 'fsevents'],
    mainFields: ['module', 'main'],
    format: 'cjs',
    loader: {
        '.js': 'jsx',
    },
    resolveExtensions: ['.ts', '.js', '.mjs', '.cjs'],
    conditions: ['import', 'require'],
}

const configs = [
    {
        ...commonConfig,
        entryPoints: ['src/cli.ts'],
        outfile: 'dist/cli.js',
    },
    {
        ...commonConfig,
        entryPoints: ['src/extension.ts'],
        outfile: 'dist/extension.js',
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
