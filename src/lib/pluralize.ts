// S2.2 — single helper so we stop hand-writing "1 applications" / "0 of 0".
//
// pluralize(0, 'application')           → '0 applications'
// pluralize(1, 'application')           → '1 application'
// pluralize(3, 'application')           → '3 applications'
// pluralize(2, 'opportunity', 'opportunities')
//                                       → '2 opportunities'
export function pluralize(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : (plural ?? singular + 's')}`
}
