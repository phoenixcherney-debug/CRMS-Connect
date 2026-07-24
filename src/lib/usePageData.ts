import { useEffect } from 'react'

/** Kick off a refetchable page loader from an effect without a synchronous
 *  setState path (react-hooks/set-state-in-effect). The tick of deferral is
 *  invisible next to the network round-trip; `refreshMs` adds polling.
 *
 *  The loader is handed an `isActive()` guard: it returns false once this effect
 *  run has been torn down (unmount, dep change, or the next poll tick), so a
 *  slow or out-of-order response can't clobber fresher state. This is the
 *  last-write-wins guard the hand-rolled `useEffect` loaders had, folded in here
 *  so every page can share one convention (review Architecture A-05). */
export function usePageData(
  load: (isActive: () => boolean) => void | Promise<void>,
  refreshMs?: number,
) {
  useEffect(() => {
    let active = true
    const isActive = () => active
    const run = () => load(isActive)
    const t = setTimeout(run, 0)
    const i = refreshMs ? setInterval(run, refreshMs) : undefined
    return () => {
      active = false
      clearTimeout(t)
      if (i) clearInterval(i)
    }
  }, [load, refreshMs])
}
