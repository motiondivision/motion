"use client"

import * as React from "react"
import { Suspense, useRef, useState } from "react"
import { useIsomorphicLayoutEffect } from "../../utils/use-isomorphic-effect"
import { AnimatePresence } from "../AnimatePresence"
import type { AnimateSuspenseProps } from "./types"

type SetSuspendedRef = React.MutableRefObject<(v: boolean) => void>

/**
 * Rendered as React's Suspense fallback. Its mount/unmount tells us when
 * the boundary enters/leaves the suspended state.
 */
function SuspenseTracker({ setRef }: { setRef: SetSuspendedRef }) {
    useIsomorphicLayoutEffect(() => {
        setRef.current(true)
        return () => setRef.current(false)
    }, [])
    return null
}

/**
 * Wraps the actual children. Its mount confirms children rendered without
 * suspending, allowing us to flip `isSuspended` back to `false` regardless
 * of whether the tracker above ever fired.
 */
function ResolveTracker({
    children,
    setRef,
}: {
    children: React.ReactNode
    setRef: SetSuspendedRef
}) {
    useIsomorphicLayoutEffect(() => {
        setRef.current(false)
    }, [])
    return <>{children}</>
}

/**
 * `AnimateSuspense` enables animated transitions between a loading fallback
 * and streamed or lazy-loaded content. It mirrors React's `Suspense` API but
 * the `fallback` can be a `motion` component whose `exit` animation plays
 * when children resolve.
 *
 * ```jsx
 * import { motion, AnimateSuspense } from "framer-motion"
 *
 * <AnimateSuspense
 *   fallback={
 *     <motion.div
 *       initial={{ opacity: 0 }}
 *       animate={{ opacity: 1 }}
 *       exit={{ opacity: 0 }}
 *     >
 *       Loading...
 *     </motion.div>
 *   }
 * >
 *   <LazyContent />
 * </AnimateSuspense>
 * ```
 *
 * The fallback only renders when children actually suspend — non-suspending
 * children mount directly without a fallback flash.
 *
 * @public
 */
export function AnimateSuspense({
    children,
    fallback,
    custom,
    initial,
    mode = "sync",
    onExitComplete,
}: AnimateSuspenseProps) {
    const [isSuspended, setIsSuspended] = useState(false)

    /**
     * Stable ref-based callback so the tracker effects only depend on `[]`
     * and never re-fire if `setIsSuspended` is ever wrapped by an HOC.
     */
    const setRef = useRef(setIsSuspended)
    setRef.current = setIsSuspended

    return (
        <>
            <Suspense fallback={<SuspenseTracker setRef={setRef} />}>
                <ResolveTracker setRef={setRef}>{children}</ResolveTracker>
            </Suspense>
            <AnimatePresence
                custom={custom}
                initial={initial}
                mode={mode}
                onExitComplete={onExitComplete}
            >
                {isSuspended ? fallback : null}
            </AnimatePresence>
        </>
    )
}
