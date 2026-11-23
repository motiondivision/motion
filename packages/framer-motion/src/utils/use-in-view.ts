"use client"

import { RefObject, useEffect, useState } from "react"
import { observeIntersection } from "../motion/features/viewport/observers"
import type { InViewOptions } from "../render/dom/viewport"

export interface UseInViewOptions
    extends Omit<InViewOptions, "root" | "amount"> {
    root?: RefObject<Element | null>
    once?: boolean
    amount?: "some" | "all" | number
    initial?: boolean
}

export function useInView(
    ref: RefObject<Element | null>,
    {
        root,
        margin,
        amount,
        once = false,
        initial = false,
    }: UseInViewOptions = {}
) {
    const [isInView, setInView] = useState(initial)
    /**
     * Holds the element the observer was last set up with. Replacing the
     * object (rather than using a ref) re-runs the observer effect.
     */
    const [observed, observe] = useState<{ current?: Element | null }>({})

    useEffect(() => {
        const element = (observed.current = ref.current)
        if (!element || (once && isInView)) return

        /**
         * Elements observed with the same settings share an observer, as
         * whileInView's do, so many components don't each make one.
         */
        let isIntersecting = false
        const stop = observeIntersection(
            element,
            {
                root: (root && root.current) || undefined,
                rootMargin: margin,
                threshold:
                    typeof amount === "number"
                        ? amount
                        : amount === "all"
                        ? 1
                        : 0,
            },
            (entry) => {
                if (entry.isIntersecting === isIntersecting) return
                isIntersecting = entry.isIntersecting
                setInView(isIntersecting)
                once && isIntersecting && stop()
            }
        )
        return stop
    }, [root, ref, margin, once, amount, observed])

    /**
     * The ref object never changes, so if the element is attached, swapped
     * or removed after mount (e.g. conditional rendering) the effect above
     * won't re-run by itself. Check after every commit and re-observe,
     * resetting to false as the new element (if any) hasn't been seen yet.
     */
    useEffect(() => {
        if (ref.current !== observed.current) {
            once || setInView(false)
            observe({})
        }
    })

    return isInView
}
