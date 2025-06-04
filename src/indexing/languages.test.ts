import fs from 'fs'
import path from 'path'
import { AsymmetricMatcher, describe, expect, it } from 'bun:test'
import { createParsers, extractCodeBlockFromMatch, extractCodeMatches } from './languages'

describe('extractCodeMatches', async () => {
    const match = (pattern: string) => expect.stringMatching(patternToRegexp(pattern))

    it('extract typescript code chunks', async () => {
        await testLanguageExtraction('typescript', 'example.ts', [
            // Captures package-level types
            { name: 't1', type: 'type', content: match('type t1 = {...}') },
            { name: 't2', type: 'type', content: match('type t2 = {...}') },
            { name: 'i1', type: 'type', content: match('interface i1 {...}') },

            // Captures package-level var/let/const
            { name: 'l1', type: 'var', content: match('let l1 = 110') },
            { name: 'c1', type: 'var', content: match('const c1 = 120') },
            { name: 'l2', type: 'var', content: match('let l2 = 130') },
            { name: 'c2', type: 'var', content: match('const c2 = 140') },

            // Captures classes
            { name: 'C1', type: 'class', content: match('class C1 {...}') },
            { name: 'C2', type: 'class', content: match('class C2 {...}') },

            // Captures methods
            { name: 'm1', type: 'method', content: match('m1() {...}') },
            { name: 'm2', type: 'method', content: match('static m2() {...}') },
            { name: 'm3', type: 'method', content: match('static m3() {...}') },

            // Captures package-level functions
            { name: 'f1', type: 'function', content: match('function f1() {...}') },
            { name: 'f2', type: 'function', content: match('function f2() {...}') },
            { name: 'f3', type: 'function', content: match('function f3() {...}') },
            { name: 'f4', type: 'function', content: match('function f4() {...}') },

            // Captures named functions within other functions
            { name: 'cmp1', type: 'named-arrow-function', content: match('cmp1 = (...) => ...') },
            { name: 'cmp2', type: 'named-arrow-function', content: match('cmp2 = (...) => ...') },
            { name: 'cmp3', type: 'function', content: match('function cmp3(...) {...}') },

            // Captures functions attached to constructed object literals
            { name: 'k1', type: 'named-arrow-function', content: match('k1: (...) => ...') },
            { name: 'k2', type: 'named-arrow-function', content: match('k2: () => ...') },
            { name: 'k3', type: 'named-arrow-function', content: match('k3: function (...) {...}') },
            { name: 'm4', type: 'method', content: match('m4(...) {...}') },
        ])
    })

    it('extracts go code chunks', async () => {
        await testLanguageExtraction('go', 'example.go', [
            // Captures package-level consts
            { name: 'c1', type: 'var', content: match('c1 = 110') },
            { name: 'c2', type: 'var', content: match('c2 = 120') },
            { name: 'c3', type: 'var', content: match('c3 = 130') },

            // Captures package-level vars
            { name: 'v1', type: 'var', content: match('v1 = 140') },
            { name: 'v2', type: 'var', content: match('v2 = 150') },
            { name: 'v3', type: 'var', content: match('v3 = 160') },

            // Captures package-level funcs
            { name: 'F', type: 'func', content: match('func F() {...}') },
            { name: 'NewProxy', type: 'func', content: match('func NewProxy() *Proxy {...}') },

            // Captures package-level methods
            { name: 'M', type: 'func', content: match('func (s S) M() {...}') },
            { name: 'Do', type: 'func', content: match('func (s S) Do() error {...}') },

            // Captures package-level types
            { name: 'S', type: 'type', content: match('S struct {...}') },
            { name: 'I', type: 'type', content: match('I interface {...}') },
            { name: 'S2', type: 'type', content: match('S2 struct{...}') },
            { name: 'S3', type: 'type', content: match('S3 = S2') },
            { name: 'S4', type: 'type', content: match('S4 S3') },
            { name: 'Proxy', type: 'type', content: match('Proxy struct {...}') },

            // Captures named function expressions
            { name: 'f1', type: 'named-func-expr', content: match('f1 = func() {...}') },
            { name: 'f2', type: 'named-func-expr', content: match('f2 func() = func() {...}') },
            { name: 'f3', type: 'named-func-expr', content: match('f3 := func() {...}') },
            { name: 'do', type: 'named-func-expr', content: match('do: func() error {...}') },
        ])
    })

    it('extracts java code chunks', async () => {
        await testLanguageExtraction('java', 'example.java', [
            // Captures classes
            { name: 'Example', type: 'class', content: match('class Example {...}') },
            { name: 'AnotherExample', type: 'class', content: match('class AnotherExample {...}') },
            { name: 'InnerExample', type: 'class', content: match('class InnerExample {...}') },

            // Captures interfaces
            { name: 'ExampleListener', type: 'interface', content: match('interface ExampleListener {...}') },
            { name: 'Processor', type: 'interface', content: match('interface Processor {...}') },

            // Captures enums
            { name: 'Status', type: 'enum', content: match('enum Status {...}') },
            { name: 'Priority', type: 'enum', content: match('enum Priority {...}') },

            // Captures fields
            { name: 'field1', type: 'field', content: match('int field1 = 100') },
            { name: 'field2', type: 'field', content: match('String field2 = "test"') },
            { name: 'PI', type: 'field', content: match('double PI = 3.14159') },
            { name: 'items', type: 'field', content: match('List<String> items') },
            { name: 'innerField', type: 'field', content: match('String innerField') },
            { name: 'description', type: 'field', content: match('String description') },
            { name: 'value', type: 'field', content: match('int value') },
            { name: 'VERSION', type: 'field', content: match('String VERSION = "1.0"') },

            // Captures methods
            { name: 'addItem', type: 'method', content: match('void addItem(String item) {...}') },
            { name: 'getFirstItem', type: 'method', content: match('String getFirstItem() {...}') },
            { name: 'calculateSum', type: 'method', content: match('static int calculateSum(int a, int b) {...}') },
            { name: 'processItems', type: 'method', content: match('void processItems() {...}') },
            { name: 'getInnerField', type: 'method', content: match('String getInnerField() {...}') },
            { name: 'getDescription', type: 'method', content: match('String getDescription() {...}') },
            { name: 'setDescription', type: 'method', content: match('void setDescription(String description) {...}') },
            { name: 'getValue', type: 'method', content: match('int getValue() {...}') },
            { name: 'process', type: 'method', content: match('void process(String input)') },
            { name: 'getResult', type: 'method', content: match('String getResult()') },

            // Captures constructors
            { name: 'Example', type: 'constructor', content: match('Example() {...}') },
            { name: 'InnerExample', type: 'constructor', content: match('InnerExample(String value) {...}') },
            { name: 'AnotherExample', type: 'constructor', content: match('AnotherExample(int value) {...}') },
        ])
    })
})

type ExpectedBlock = {
    name: string
    type: string
    content: string | AsymmetricMatcher
}

async function testLanguageExtraction(language: string, testFilePath: string, expectedBlocks: ExpectedBlock[]) {
    const parser = (await createParsers()).find(p => p.name === language)!
    if (!parser) {
        throw new Error(`Parser for language '${language}' not found`)
    }

    const content = fs.readFileSync(path.join(__dirname, 'testdata', testFilePath), 'utf8')

    const blocks: ExpectedBlock[] = []
    for (const { queryType, match } of extractCodeMatches(content, parser)) {
        const block = extractCodeBlockFromMatch(content, queryType, match)

        if (block) {
            blocks.push({ name: block.name, type: block.type, content: block.content })
        }
    }

    blocks.sort((a, b) => a.name.localeCompare(b.name))
    expectedBlocks.sort((a, b) => a.name.localeCompare(b.name))
    expect(blocks).toMatchObject(expectedBlocks)
}

function patternToRegexp(pattern: string): RegExp {
    return new RegExp(
        '^' +
            pattern
                .replace(/\.\.\./g, '@@@') // Replace '...' with a non-metacharacters
                .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') // Escape metacharacters
                .replace(/@@@/g, '[\\s\\S]*?') + // Replace placeholder with non-greedy match
            '$',
        'g',
    )
}
