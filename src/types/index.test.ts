import { describe, expect, it } from 'vitest'
import { affiliationLabel } from './index'

describe('affiliationLabel', () => {
  it('shows class year for alumni', () => {
    expect(affiliationLabel({ role: 'member', affiliation: 'alumni', class_year: 2002 })).toBe('Class of ’02')
  })
  it('falls back when an alum has no year', () => {
    expect(affiliationLabel({ role: 'member', affiliation: 'alumni', class_year: null })).toBe('Alum')
  })
  it('labels parents and staff', () => {
    expect(affiliationLabel({ role: 'member', affiliation: 'parent', class_year: null })).toBe('CRMS parent')
    expect(affiliationLabel({ role: 'member', affiliation: 'faculty_staff', class_year: null })).toBe('Faculty & staff')
    expect(affiliationLabel({ role: 'member', affiliation: 'friend', class_year: null })).toBe('Friend of the school')
  })
  it('marks students as students, with their class year', () => {
    expect(affiliationLabel({ role: 'student', affiliation: null, class_year: 2027 })).toBe('Class of ’27 (student)')
    expect(affiliationLabel({ role: 'student', affiliation: null, class_year: null })).toBe('Current student')
  })
  it('labels admins as CRMS staff regardless of affiliation', () => {
    expect(affiliationLabel({ role: 'admin', affiliation: 'faculty_staff', class_year: null })).toBe('CRMS staff')
  })
})
