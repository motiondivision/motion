"use client"

import { autoSize, AutoSizeOptions } from "motion-dom"
import { RefObject, useEffect } from "react"

/**
 * Animates the element's height (or width, with `axis`) whenever its
 * natural, auto size changes, for instance when its content changes.
 *
 * ```jsx
 * const ref = useRef(null)
 * useAutoSize(ref, { duration: 0.3 })
 *
 * return <div ref={ref} style={{ overflow: "hidden" }}>{content}</div>
 * ```
 */
export function useAutoSize(
    ref: RefObject<HTMLElement | null>,
    options?: AutoSizeOptions
) {
    useEffect(() => {
        if (ref.current) return autoSize(ref.current, options)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- options are read on mount
    }, [ref])
}
