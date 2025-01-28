import esbuild from 'esbuild'

esbuild
    .build({
        entryPoints: ['./src/extension.ts'],
        bundle: true,
        platform: 'node',
        target: 'node18',
        outdir: './dist',
        outbase: './src',
        outExtension: { '.js': '.cjs' },
        format: 'cjs',
        external: ['vscode'],
        loader: { '.ts': 'ts', '.js': 'js' },
        logLevel: 'info',
    })
    .catch(() => process.exit(1))
