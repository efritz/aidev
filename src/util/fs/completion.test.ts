import { parseArgsWithEscapedSpaces } from './completion'

describe('parseArgsWithEscapedSpaces', () => {
    it('should parse paths separated by spaces', () => {
        expect(parseArgsWithEscapedSpaces('foo.txt bar.txt  baz.txt')).toEqual(['foo.txt', 'bar.txt', 'baz.txt'])
        expect(parseArgsWithEscapedSpaces('foo.txt bar.txt baz.txt ')).toEqual(['foo.txt', 'bar.txt', 'baz.txt'])
    })

    it('should parse paths with escaped spaces', () => {
        expect(parseArgsWithEscapedSpaces('foo.txt bar\\ baz.txt bonk.txt')).toEqual([
            'foo.txt',
            'bar baz.txt',
            'bonk.txt',
        ])

        // unterminated escape implicit adds space to last element
        expect(parseArgsWithEscapedSpaces('foo.txt bar\\')).toEqual(['foo.txt', 'bar '])
    })

    it('should parse quoted paths', () => {
        // single quote
        expect(parseArgsWithEscapedSpaces("foo 'bar baz.txt' bonk.txt")).toEqual(['foo', 'bar baz.txt', 'bonk.txt'])

        // double quote
        expect(parseArgsWithEscapedSpaces('foo "bar baz.txt" bonk.txt')).toEqual(['foo', 'bar baz.txt', 'bonk.txt'])

        // unterminated quote implicitly closed by end of string
        expect(parseArgsWithEscapedSpaces('foo "bar baz')).toEqual(['foo', 'bar baz'])
    })

    it('should reject non-space escape sequence', () => {
        expect(() => parseArgsWithEscapedSpaces('foo\\n bar.txt')).toThrow()
    })
})
