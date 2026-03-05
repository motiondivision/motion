"use client"

import * as React from "react"
import { useRef, useCallback } from "react"
import { SpringOptions } from "motion-dom"
import { useSpring } from "../../value/use-spring"
import { useMotionValueEvent } from "../../utils/use-motion-value-event"

interface AnimateNumberProps
    extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
    /**
     * The target number to animate to.
     */
    children: number

    /**
     * Intl.NumberFormat options for formatting the displayed number.
     *
     * @example
     * ```jsx
     * <AnimateNumber format={{ style: "currency", currency: "USD" }}>
     *   {1234.56}
     * </AnimateNumber>
     * ```
     */
    format?: Intl.NumberFormatOptions

    /**
     * A BCP 47 language tag or array of tags for number formatting.
     *
     * @default undefined (uses runtime default locale)
     */
    locales?: Intl.LocalesArgument

    /**
     * Spring animation options.
     *
     * @default \{ damping: 60, stiffness: 500 \}
     */
    transition?: SpringOptions
}

const defaultTransition: SpringOptions = {
    damping: 60,
    stiffness: 500,
}

function AnimateNumber({
    children: value,
    format,
    locales,
    transition = defaultTransition,
    ...props
}: AnimateNumberProps) {
    const ref = useRef<HTMLSpanElement>(null)

    const formatter = React.useMemo(
        () => new Intl.NumberFormat(locales, format),
        [locales, JSON.stringify(format)]
    )

    const springValue = useSpring(value, transition)

    const updateDisplay = useCallback(
        (latest: number) => {
            if (ref.current) {
                ref.current.textContent = formatter.format(latest)
            }
        },
        [formatter]
    )

    useMotionValueEvent(springValue, "change", updateDisplay)

    return (
        <span ref={ref} {...props}>
            {formatter.format(value)}
        </span>
    )
}

export { AnimateNumber }
export type { AnimateNumberProps }
