"use client"

import * as React from "react"
import { Suspense, useState } from "react"
import { AnimatePresence } from "../AnimatePresence"
import { useIsomorphicLayoutEffect } from "../../utils/use-isomorphic-effect"
import type { AnimateSuspenseProps } from "./types"

/**
 * Internal component rendered as React Suspense's fallback.
 * Mounts when children suspend, unmounts when they resolve.
 */
function SuspenseTracker({
    onChange,
}: {
    onChange: (v: boolean) => void
}) {
    useIsomorphicLayoutEffect(() => {
        onChange(true)
        return () => onChange(false)
    }, [onChange])
    return null
}

/**
 * Internal wrapper that detects when children render without suspending.
 * Handles the case where children never throw a promise.
 */
function ResolveTracker({
    children,
    onChange,
}: {
    children: React.ReactNode
    onChange: (v: boolean) => void
}) {
    useIsomorphicLayoutEffect(() => {
        onChange(false)
    }, [onChange])
    return <>{children}</>
}

/**
 * `AnimateSuspense` enables animated transitions between a loading fallback
 * and streamed/lazy-loaded content using React Suspense.
 *
 * It has the same basic API as React's `Suspense`, but the `fallback` can be
 * a `motion` component with `exit` animations that will play when children resolve.
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
 *   <AsyncContent />
 * </AnimateSuspense>
 * ```
 *
 * @public
 */
export function AnimateSuspense({
    children,
    fallback,
    initial,
    mode = "wait",
    onExitComplete,
}: AnimateSuspenseProps) {
    const [isSuspended, setIsSuspended] = useState(true)

    return (
        <>
            <Suspense
                fallback={
                    <SuspenseTracker onChange={setIsSuspended} />
                }
            >
                <ResolveTracker onChange={setIsSuspended}>
                    {children}
                </ResolveTracker>
            </Suspense>
            <AnimatePresence
                initial={initial}
                mode={mode}
                onExitComplete={onExitComplete}
            >
                {isSuspended ? fallback : null}
            </AnimatePresence>
        </>
    )
}
