import { useEffect } from 'react'

/** Kick off a refetchable page loader from an effect without a synchronous
 *  setState path (react-hooks/set-state-in-effect). The tick of deferral is
 *  invisible next to the network round-trip; `refreshMs` adds polling. */
export function usePageData(load: () => void | Promise<void>, refreshMs?: number) {
  useEffect(() => {
    const t = setTimeout(load, 0)
    const i = refreshMs ? setInterval(load, refreshMs) : undefined
    return () => {
      clearTimeout(t)
      if (i) clearInterval(i)
    }
  }, [load, refreshMs])
}
