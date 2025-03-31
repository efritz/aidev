import { describe, expect, it } from 'bun:test'
import { createXmlPartialClosingTagPattern, createXmlPartialOpeningTagPattern, createXmlPattern } from './xml'

describe('createXmlPattern', () => {
    const prefix = 'before'
    const infix = 'between'
    const suffix = 'after'
    const pattern = createXmlPattern('test')

    it('should match tag with content', () => {
        const tag = '<test>content</test>'
        const matches = [...(prefix + tag + suffix).matchAll(pattern)]
        expect(matches).toHaveLength(1)
        expect([...matches[0]]).toEqual([tag, '<test>', 'content', '</test>'])
    })

    it('should match multiple occurrences', () => {
        const tag1 = '<test>content-1</test>'
        const tag2 = '<test>content-2</test>'
        const matches = [...(prefix + tag1 + infix + tag2 + suffix).matchAll(pattern)]
        expect(matches).toHaveLength(2)
        expect([...matches[0]]).toEqual([tag1, '<test>', 'content-1', '</test>'])
        expect([...matches[1]]).toEqual([tag2, '<test>', 'content-2', '</test>'])
    })

    it('should match tag with attributes', () => {
        const tag = '<test attr="value">content</test>'
        const matches = [...(prefix + tag + suffix).matchAll(pattern)]
        expect(matches).toHaveLength(1)
        expect([...matches[0]]).toEqual([tag, '<test attr="value">', 'content', '</test>'])
    })

    it('should match tag with incomplete closing tag', () => {
        const tag = '<test>content'
        const matches = [...(prefix + tag).matchAll(pattern)]
        expect(matches).toHaveLength(1)
        expect([...matches[0]]).toEqual([tag, '<test>', 'content', ''])
    })
})

describe('createXmlPartialOpeningTagPattern', () => {
    const prefix = 'before'
    const pattern = createXmlPartialOpeningTagPattern('test')

    it('should match all prefixes of an opening tag', () =>
        ['<', '<t', '<te', '<tes', '<test', '<test>'].forEach(testCase =>
            expect((prefix + testCase).match(pattern)).toEqual([testCase]),
        ))

    it('should match an incomplete opening tag with attributes', () =>
        ['<test attr', '<test attr=', '<test attr="val', '<test attr="value"'].forEach(testCase =>
            expect((prefix + testCase).match(pattern)).toEqual([testCase]),
        ))

    it('should not match an opening tag not at the end of the string', () =>
        ['<test>after'].forEach(testCase => expect((prefix + testCase).match(pattern)).toBeNull()))

    it('should not match a closing tag', () =>
        ['</test>'].forEach(testCase => expect((prefix + testCase).match(pattern)).toBeNull()))
})

describe('createXmlPartialClosingTagPattern', () => {
    const prefix = 'before'
    const pattern = createXmlPartialClosingTagPattern('test')

    it('should match all prefixes of a closing tag', () =>
        ['<', '</', '</t', '</te', '</tes', '</test', '</test>'].forEach(testCase =>
            expect((prefix + testCase).match(pattern)).toEqual([testCase]),
        ))

    it('should not match a closing tag not at the end of the string', () =>
        ['</test>after'].forEach(testCase => expect((prefix + testCase).match(pattern)).toBeNull()))

    it('should not match an opening tag', () =>
        ['<test>'].forEach(testCase => expect((prefix + testCase).match(pattern)).toBeNull()))
})
