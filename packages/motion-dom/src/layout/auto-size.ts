import { animateMotionValue } from "../animation/interfaces/motion-value"
import type { ValueTransition } from "../animation/types"
import { frame } from "../frameloop"
import { motionValue, MotionValue } from "../value"

export interface AutoSizeOptions extends ValueTransition {
    /**
     * Which size to animate: `"y"` (height, default), `"x"` (width)
     * or `"both"`.
     */
    axis?: "x" | "y" | "both"
}

type Dimension = "width" | "height"
type Size = Record<Dimension, number>

/**
 * Animates an element between its auto sizes. Whenever its natural size
 * changes, for instance because its content changed, it animates from the
 * previous size to the new one and then returns to its original styles.
 *
 * ```
 * const stop = autoSize(element, { duration: 0.3 })
 * ```
 *
 * When only animating height, a size change that also changes the width
 * (like a reflow after the window resizes) is applied instantly.
 */
export function autoSize(
    element: HTMLElement,
    { axis = "y", ...transition }: AutoSizeOptions = {}
) {
    const dimensions: Dimension[] =
        axis === "both"
            ? ["width", "height"]
            : [axis === "x" ? "width" : "height"]
    const { style } = element
    const computed = getComputedStyle(element)
    /**
     * The inline styles to return to once an animation finishes.
     */
    let restoreTo: Partial<Record<Dimension, string>> = {}
    const values: Partial<Record<Dimension, MotionValue<number>>> = {}

    /**
     * The latest natural size. While animating, this is the target.
     */
    let natural: Size | undefined
    let isWatchingContent = false
    let skipInitial = false

    const measure = (): Size => ({
        width: parseFloat(computed.width),
        height: parseFloat(computed.height),
    })

    const isAnimating = () =>
        dimensions.some((dimension) => values[dimension]?.isAnimating())

    const restore = () => {
        for (const dimension of dimensions) {
            if (restoreTo[dimension] !== undefined) {
                style[dimension] = restoreTo[dimension]!
            }
        }
    }

    /**
     * While animating, the element has a fixed size, so watch its content
     * instead, and measure its natural size when that changes.
     */
    const measureContent = () => {
        if (!isWatchingContent) return
        const animated = { width: style.width, height: style.height }
        restore()
        const size = measure()
        Object.assign(style, animated)
        update(size)
    }
    const remeasure = () => frame.read(measureContent)

    /**
     * Observes the element while idle, and its children while animating.
     */
    const resizeObserver = new ResizeObserver(() =>
        isWatchingContent
            ? skipInitial
                ? (skipInitial = false)
                : remeasure()
            : update(measure())
    )
    const mutationObserver = new MutationObserver(remeasure)

    const stopObserving = () => {
        resizeObserver.disconnect()
        mutationObserver.disconnect()
    }

    const finish = () => {
        if (isAnimating() || !isWatchingContent) return
        isWatchingContent = false
        stopObserving()
        restore()
        restoreTo = {}
        /**
         * Picks up any size change missed while animating.
         */
        resizeObserver.observe(element)
    }

    function update(size: Size) {
        const snap = axis === "y" && natural && size.width !== natural.width

        for (const dimension of dimensions) {
            const from = natural?.[dimension]
            const to = size[dimension]
            let value = values[dimension]

            if (snap) {
                value?.stop()
                continue
            }

            if (!value?.isAnimating()) {
                /**
                 * Only animate between auto sizes. A size set by another
                 * animation or style isn't a natural size, so isn't
                 * animated from either.
                 */
                const current = style[dimension]
                if (current && current !== "auto") {
                    size[dimension] = NaN
                    continue
                }

                // Also skips the first measurement (undefined) and NaN
                if (!(from! >= 0) || from === to) continue

                restoreTo[dimension] = current

                if (!value) {
                    value = values[dimension] = motionValue(from!)
                    value.on("change", (v) => (style[dimension] = v + "px"))
                }
                value.jump(from!)

                /**
                 * Write the previous size before the browser paints the
                 * new one.
                 */
                style[dimension] = from + "px"
            } else if (from === to) {
                continue
            }

            value
                .start(animateMotionValue(dimension, value, to, transition))
                .then(finish)
        }

        natural = size

        if (isAnimating()) {
            if (!isWatchingContent) {
                isWatchingContent = skipInitial = true
                resizeObserver.unobserve(element)
                for (const child of element.children) {
                    resizeObserver.observe(child)
                }
                mutationObserver.observe(element, {
                    childList: true,
                    characterData: true,
                    subtree: true,
                })
            }
        } else {
            finish()
        }
    }

    resizeObserver.observe(element)

    return () => {
        stopObserving()
        for (const dimension of dimensions) values[dimension]?.stop()
        isWatchingContent && restore()
    }
}
