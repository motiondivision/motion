"use client"

import type { AnimationDefinition } from "motion-dom"
import { useContext, useInsertionEffect } from "react"
import { MotionContext } from "../context/MotionContext"

/**
 * Subscribe to the nearest parent motion component's animation completion.
 *
 * This allows child components to know when a parent animation has finished
 * without tight coupling between the parent and child.
 *
 * ```jsx
 * function ChildComponent() {
 *   useAnimationComplete((definition) => {
 *     // Parent animation has finished, safe to measure layout
 *     const rect = ref.current.getBoundingClientRect()
 *   })
 *
 *   return <div ref={ref}>...</div>
 * }
 *
 * // Used as a child of any motion component:
 * <motion.div animate={{ x: 0 }}>
 *   <ChildComponent />
 * </motion.div>
 * ```
 *
 * @param callback - Called when the parent animation completes
 */
export function useAnimationComplete(
    callback: (definition: AnimationDefinition) => void
) {
    const { visualElement } = useContext(MotionContext)

    useInsertionEffect(
        () => visualElement?.on("AnimationComplete", callback),
        [visualElement, callback]
    )
}
