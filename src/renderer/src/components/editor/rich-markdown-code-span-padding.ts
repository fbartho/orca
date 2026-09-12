import { createMarkBoundaryWalkExtension } from './rich-markdown-mark-boundary-walk'
import type { MarkdownNodeLike } from './rich-markdown-mark-boundary-walk'

// Why: a private-use code point the serializer does not itself reserve — upstream
// builds its mark-delimiter probe out of U+E000 and U+E001.
const PADDING_SENTINEL = String.fromCharCode(0xe002)

// Why: distinct from the sentinel so an index cannot be read as a mask boundary.
const INDEX_TERMINATOR = String.fromCharCode(0xe003)

function hasCodeMark(node: MarkdownNodeLike): boolean {
  return (node.marks ?? []).some(
    (mark) => (typeof mark === 'string' ? mark : mark?.type) === 'code'
  )
}

/**
 * One mask-and-restore pair. Restoration replaces placeholders this session issued,
 * identified by their position in its own table rather than by their text, so a
 * document that already holds an identical run is left alone.
 */
export type CodeSpanPaddingSession = {
  mask: (nodes: MarkdownNodeLike[]) => MarkdownNodeLike[]
  restore: (markdown: string) => string
}

/**
 * Hides a code span's leading and trailing whitespace from the mark-boundary walk.
 * The walk strips whitespace off a marked run and re-appends it outside the
 * delimiters, which is right for emphasis (`** text **` is not emphasis) and wrong
 * for a code span, where CommonMark strips one pad on render and the source keeps
 * its bytes.
 */
export function createCodeSpanPaddingSession(): CodeSpanPaddingSession {
  // Why: the index into this table is what a placeholder encodes, so each padding
  // character gets its own placeholder and restoration is a lookup, not a text match.
  const issued: string[] = []

  // Why: chosen once per pass from the text going in, so it cannot collide with what
  // the document already holds. Empty until `mask` has seen the nodes.
  let fence = ''

  function placeholderFor(character: string): string {
    const index = issued.push(character) - 1
    return `${fence}${index}${INDEX_TERMINATOR}${fence}`
  }

  /**
   * Each padding character replaced by a placeholder carrying its table index. Both
   * ends are fenced because the walk strips a leading run and a trailing run, so
   * neither end of a masked run may be a character `\s` matches.
   */
  function maskPadding(padding: string): string {
    return Array.from(padding, placeholderFor).join('')
  }

  /**
   * A sentinel run one longer than the longest the incoming text holds, so no
   * placeholder built from it can occur in the document literally.
   */
  function chooseFence(nodes: MarkdownNodeLike[]): string {
    const longest = nodes.reduce((longestSoFar, node) => {
      const runs = (node?.text ?? '').match(new RegExp(`${PADDING_SENTINEL}+`, 'g')) ?? []
      return runs.reduce((best, run) => Math.max(best, run.length), longestSoFar)
    }, 0)
    return PADDING_SENTINEL.repeat(longest + 1)
  }

  return {
    mask: (nodes) => {
      fence = chooseFence(nodes)
      return nodes.map((node) => {
        if (node?.type !== 'text' || !hasCodeMark(node)) {
          return node
        }
        const text = node.text ?? ''
        // Why: one match partitions the text, so an all-whitespace span cannot have
        // its padding counted as both leading and trailing.
        const [, leading = '', body = '', trailing = ''] =
          text.match(/^(\s*)([\s\S]*?)(\s*)$/) ?? []
        if (!leading && !trailing) {
          return node
        }
        return {
          ...node,
          text: maskPadding(leading) + body + maskPadding(trailing)
        }
      })
    },
    restore: (markdown) => {
      let restored = markdown
      issued.forEach((character, index) => {
        const placeholder = `${fence}${index}${INDEX_TERMINATOR}${fence}`
        // Why: the fence rules out a literal match, so a count other than one means
        // the walk reshaped the placeholder; leaving it is safer than guessing.
        if (restored.split(placeholder).length - 1 !== 1) {
          return
        }
        // Why: the replacer form, because a `$` in a replacement string is a
        // substitution pattern and a padding character is not known to exclude one.
        restored = restored.replace(placeholder, () => character)
      })
      return restored
    }
  }
}

/**
 * Keeps a code span's padding inside its backticks.
 */
export const RichMarkdownCodeSpanPadding = createMarkBoundaryWalkExtension({
  name: 'richMarkdownCodeSpanPadding',
  createSession: createCodeSpanPaddingSession
})
