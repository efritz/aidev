module.exports = {
    semi: false,
    singleQuote: true,
    trailingComma: 'all',
    tabWidth: 4,
    printWidth: 120,
    arrowParens: 'avoid',
    plugins: [require.resolve('@ianvs/prettier-plugin-sort-imports')],
    importOrder: ['<THIRD_PARTY_MODULES>', '^(?!\\.\\/)(\\.\\.\\/.*$|\\.\\.$)', '^(\\.\\/.*$|\\.$)'],
}
