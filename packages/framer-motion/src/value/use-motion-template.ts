"use client"

import { isMotionValue, MotionValue } from "motion-dom"
import { useCombineMotionValues } from "./use-combine-values"

/**
 * Combine multiple motion values into a new one using a string template literal.
 *
 * ```jsx
 * import {
 *   motion,
 *   useSpring,
 *   useMotionValue,
 *   useMotionTemplate
 * } from "framer-motion"
 *
 * function Component() {
 *   const shadowX = useSpring(0)
 *   const shadowY = useMotionValue(0)
 *   const shadow = useMotionTemplate`drop-shadow(${shadowX}px ${shadowY}px 20px rgba(0,0,0,0.3))`
 *
 *   return <motion.div style={{ filter: shadow }} />
 * }
 * ```
 *
 * @public
 */
export function useMotionTemplate(
    fragments: TemplateStringsArray,
    ...values: Array<MotionValue | number | string>
) {
    /**
     * Create a function that will build a string from the latest motion values.
     */
    const numFragments = fragments.length

    function buildValue() {
        let output = ``

        for (let i = 0; i < numFragments; i++) {
            output += fragments[i]
            const value = values[i]
            if (value) {
                output += isMotionValue(value) ? value.get() : value
            }
        }

        return output
    }

    return useCombineMotionValues(values.filter(isMotionValue), buildValue)
}
