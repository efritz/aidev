const unusedImports = require('eslint-plugin-unused-imports')
const typescriptEslint = require('@typescript-eslint/eslint-plugin')

module.exports = [
    {
        files: ['**/*.ts'],
        plugins: {
            'unused-imports': unusedImports,
            '@typescript-eslint': typescriptEslint,
        },
        rules: {
            'unused-imports/no-unused-imports': 'error',
            eqeqeq: 'error',
            'no-var': 'error',
            'no-unused-expressions': 'error',
            'no-sequences': 'error',
            'no-return-await': 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
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
