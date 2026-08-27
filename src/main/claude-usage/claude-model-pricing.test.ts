import { describe, expect, it } from 'vitest'
import { estimateCostUsd } from './claude-model-pricing'

describe('estimateCostUsd cache-write TTL rates', () => {
  it('bills 5-minute cache writes at 1.25x base input', () => {
    expect(estimateCostUsd('claude-opus-5', 0, 0, 0, 1_000_000, 0)).toBeCloseTo(6.25)
  })

  it('keeps the legacy five-argument call billing every write at the 5-minute rate', () => {
    expect(estimateCostUsd('claude-opus-5', 0, 0, 0, 1_000_000)).toBeCloseTo(6.25)
  })

  it('bills 1-hour cache writes at 2x base input', () => {
    expect(estimateCostUsd('claude-opus-5', 0, 0, 0, 1_000_000, 1_000_000)).toBeCloseTo(10)
  })

  it('splits a mixed write bucket without double-billing the 1-hour share', () => {
    expect(estimateCostUsd('claude-opus-5', 0, 0, 0, 1_000_000, 400_000)).toBeCloseTo(7.75)
  })

  it('clamps a 1-hour count that exceeds the reported write total', () => {
    expect(estimateCostUsd('claude-opus-5', 0, 0, 0, 1_000, 5_000)).toBeCloseTo(0.01)
  })

  it('applies the long-context tier to 1-hour writes', () => {
    expect(estimateCostUsd('claude-sonnet-4-6', 0, 0, 0, 400_000, 400_000)).toBeCloseTo(3.6)
  })

  it('still returns null for unknown models', () => {
    expect(estimateCostUsd('gpt-5', 0, 0, 0, 1_000_000, 1_000_000)).toBeNull()
  })
})
