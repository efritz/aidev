import { defineConfig } from 'tsup'

export default defineConfig([
    {
        entry: ['src/main.ts'],
        format: ['esm'],
        dts: true,
        target: 'es2022',
        outDir: 'dist',
        external: ['vscode'],
    },
    {
        entry: ['src/extension.ts'],
        format: ['cjs'],
        dts: true,
        target: 'es2022',
        outDir: 'dist',
        outExtension: () => ({ js: '.cjs' }),
        external: ['vscode'],
    },
])
