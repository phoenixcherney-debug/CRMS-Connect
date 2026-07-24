import { describe, it, expect } from 'vitest'
import { clampSpots, deriveOfferStatus } from './offerForm'

describe('clampSpots', () => {
  it('clamps values below the minimum up to 1', () => {
    expect(clampSpots(0)).toBe(1)
    expect(clampSpots(-5)).toBe(1)
  })
  it('clamps values above the maximum down to 20', () => {
    expect(clampSpots(50)).toBe(20)
    expect(clampSpots(21)).toBe(20)
  })
  it('passes through an in-range value', () => {
    expect(clampSpots(7)).toBe(7)
  })
  it('parses a numeric string', () => {
    expect(clampSpots('3')).toBe(3)
  })
  it('defaults empty / non-numeric input to 1', () => {
    expect(clampSpots('')).toBe(1)
    expect(clampSpots('abc')).toBe(1)
  })
})

describe('deriveOfferStatus', () => {
  it('always yields draft when saving as a draft', () => {
    expect(deriveOfferStatus('open', true)).toBe('draft')
    expect(deriveOfferStatus('draft', true)).toBe('draft')
    expect(deriveOfferStatus('closed', true)).toBe('draft')
  })
  it('promotes a current draft to open on publish', () => {
    expect(deriveOfferStatus('draft', false)).toBe('open')
  })
  it('keeps a non-draft status on publish', () => {
    expect(deriveOfferStatus('open', false)).toBe('open')
    expect(deriveOfferStatus('filled', false)).toBe('filled')
    expect(deriveOfferStatus('closed', false)).toBe('closed')
  })
})
