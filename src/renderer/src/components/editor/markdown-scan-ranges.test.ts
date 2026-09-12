import { describe, expect, it } from 'vitest'
import { findDetailsBlockStart } from './details-markdown-html'
import { markdownCodeSpanRanges, markdownFenceRanges } from './markdown-scan-ranges'

describe('markdownCodeSpanRanges', () => {
  it('reports a span whose backtick run closes on an equal run', () => {
    expect(markdownCodeSpanRanges('a `<details>` b')).toEqual([[2, 13]])
  })

  it('keeps a span that contains a blank line', () => {
    expect(markdownCodeSpanRanges('text `a\n\nb` tail')).toEqual([[5, 11]])
  })

  it('reports no span for backticks inside a fenced block', () => {
    expect(markdownCodeSpanRanges(['```', 'a `b` c', '```'].join('\n'))).toEqual([])
  })

  it('does not pair a fence backtick with a later prose backtick', () => {
    const content = ['~~~', 'x = `abc', '~~~', '', 'prose with `code` here'].join('\n')
    const spans = markdownCodeSpanRanges(content)

    expect(spans).toEqual([[29, 35]])
    expect(content.slice(29, 35)).toBe('`code`')
  })

  it('does not run a span through a four-backtick fence closer', () => {
    const content = ['```', 'code', '````', '', 'tail', '', '```', 'more', '```'].join('\n')

    expect(markdownCodeSpanRanges(content)).toEqual([])
  })
})

describe('findDetailsBlockStart with fenced content', () => {
  it('finds a details block after a fence whose content holds an unpaired backtick', () => {
    const content = [
      '~~~',
      'x = `abc',
      '~~~',
      '',
      '<details>',
      '<summary>S</summary>',
      '',
      'body',
      '',
      '</details>',
      '',
      'prose with `code` here'
    ].join('\n')

    expect(findDetailsBlockStart(content)).toBe(content.indexOf('<details>'))
  })

  it('finds a details block between a four-backtick closer and a later fence', () => {
    const content = [
      '```',
      'code',
      '````',
      '',
      '<details>',
      '<summary>S</summary>',
      '',
      'x',
      '',
      '</details>',
      '',
      '```',
      'more',
      '```'
    ].join('\n')

    expect(findDetailsBlockStart(content)).toBe(content.indexOf('<details>'))
  })

  it('skips a details mention inside a code span that spans a blank line', () => {
    expect(findDetailsBlockStart('text `a\n\n<details>b` tail')).toBe(-1)
  })
})

describe('findDetailsBlockStart cost on documents without a toggle', () => {
  // marked calls the start hook once per paragraph over the remaining source,
  // so a full range scan per call makes parsing quadratic in document size.
  it('parses a large toggle-free document within a generous bound', () => {
    const paragraphs = Array.from(
      { length: 300 },
      (_, index) => `Paragraph ${index} ${'lorem ipsum dolor sit amet '.repeat(25)}`
    )
    const document = paragraphs.join('\n\n')
    expect(document.length).toBeGreaterThan(200_000)

    const started = performance.now()
    let offset = 0
    for (const paragraph of paragraphs) {
      expect(findDetailsBlockStart(document.slice(offset))).toBe(-1)
      offset += paragraph.length + 2
    }

    expect(performance.now() - started).toBeLessThan(1_000)
  })

  it('still finds a toggle that follows a long run of prose', () => {
    const prose = Array.from({ length: 300 }, (_, index) => `Paragraph ${index}.`).join('\n\n')
    const document = `${prose}\n\n<details>\n<summary>S</summary>\n\nbody\n\n</details>`

    expect(findDetailsBlockStart(document)).toBe(document.indexOf('<details>'))
  })

  it('finds an uppercase opening tag the lowercase fast path misses', () => {
    const document = 'Prose paragraph.\n\n<DETAILS>\n<summary>S</summary>\n\nbody\n\n</DETAILS>'

    expect(findDetailsBlockStart(document)).toBe(document.indexOf('<DETAILS>'))
  })
})

describe('markdownFenceRanges', () => {
  it('covers the opening delimiter, content, and closing delimiter', () => {
    const content = ['```', 'x', '```', ''].join('\n')

    expect(markdownFenceRanges(content)).toEqual([[0, 10]])
  })

  it('runs an unterminated fence to the end of the content', () => {
    const content = ['```', 'x', 'y'].join('\n')

    expect(markdownFenceRanges(content)).toEqual([[0, content.length]])
  })
})
