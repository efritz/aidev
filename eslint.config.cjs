const unusedImports = require('eslint-plugin-unused-imports')

module.exports = [
    {
        files: ['**/*.{js,ts}'],
        plugins: {
            'unused-imports': unusedImports,
        },
        rules: {
            'unused-imports/no-unused-imports': 'error',
        },
        languageOptions: {
            parser: require('@typescript-eslint/parser'),
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
        },
    },
]