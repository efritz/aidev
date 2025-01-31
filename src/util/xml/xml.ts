// Create a regex pattern matching a paired opening and closing XML tag
// with the given name. The capture groups are the opening tag, content,
// and closing tag.
export function createXmlPattern(name: string): RegExp {
    return new RegExp(
        [
            `(<${name}(?: [^>]*)?>)`, // opening tag
            '([\\s\\S]*?)', // content
            `(</${name}>|$)`, // closing tag
        ].join(''),
        'g',
    )
}

// Create a regex pattern matching any partial prefix of an opening XML tag
// with the given name occurring at the end of the text.
export function createXmlPartialOpeningTagPattern(name: string): RegExp {
    return createSuffixPattern([
        ...prefixes('<' + name), // partial prefixes
        `<${name}( [^>]*)?>?`, // match attributes
    ])
}

// Create a regex pattern matching any partial prefix of a closing XML tag
// with the given name occurring at the end of the text.
export function createXmlPartialClosingTagPattern(name: string): RegExp {
    return createSuffixPattern(prefixes(`</${name}>`))
}

// Create a regex pattern matching any pattern occurring at the end of the text.
function createSuffixPattern(patterns: string[]): RegExp {
    return new RegExp(`(${patterns.join('|')})$`, 'g')
}

function prefixes(text: string): string[] {
    const prefixes = []
    for (let i = 1; i <= text.length; i++) {
        prefixes.push(text.substring(0, i))
    }

    return prefixes
}
