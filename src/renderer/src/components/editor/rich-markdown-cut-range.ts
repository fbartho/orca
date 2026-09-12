/**
 * The document range a cut is serializing. `clipboardTextSerializer` has a
 * fixed `(slice, view)` signature, and the cut paths serialize a computed
 * range rather than the view's selection, so the range travels here for the
 * duration of that synchronous call.
 */
const state: { range?: { from: number; to: number } } = {}

export const RICH_MARKDOWN_CUT_RANGE = {
  serializingRange<T>(range: { from: number; to: number }, serialize: () => T): T {
    const previous = state.range
    state.range = range
    try {
      return serialize()
    } finally {
      state.range = previous
    }
  },

  current(): { from: number; to: number } | undefined {
    return state.range
  }
}
