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
 *
 * The previous size is written inside a `ResizeObserver` callback, so the
 * new size is never painted. Another `ResizeObserver` on the same element
 * can report a "ResizeObserver loop" error when that happens.
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
    const values: Partial<Record<Dimension, MotionValue<number>>> = {}

    /**
     * While a dimension is animating, the inline style to return to
     * afterwards, and the inline style last written. If the inline style
     * no longer matches what was written, something else took it over.
     */
    const restoreTo: Partial<Record<Dimension, string>> = {}
    const written: Partial<Record<Dimension, string>> = {}

    /**
     * The latest natural size. While animating, this is the target.
     */
    let natural: Size | undefined
    let isWatchingContent = false

    const measure = (): Size => ({
        width: parseFloat(computed.width),
        height: parseFloat(computed.height),
    })

    const isOwned = (dimension: Dimension) =>
        restoreTo[dimension] !== undefined

    const write = (dimension: Dimension, v: number) => {
        style[dimension] = v + "px"
        written[dimension] = style[dimension]
    }

    /**
     * Stop animating a dimension, and restore its inline style unless
     * something else has taken it over.
     */
    const release = (dimension: Dimension) => {
        if (!isOwned(dimension)) return
        values[dimension]!.stop()
        if (style[dimension] === written[dimension]) {
            style[dimension] = restoreTo[dimension]!
        }
        delete restoreTo[dimension]
    }

    /**
     * While animating, the element has a fixed size, so watch its content
     * instead, and measure its natural size when that changes.
     */
    const measureContent = () => {
        if (!isWatchingContent) return
        const animated = { width: style.width, height: style.height }
        for (const dimension of dimensions) {
            if (isOwned(dimension)) style[dimension] = restoreTo[dimension]!
        }
        const size = measure()
        Object.assign(style, animated)
        update(size)
    }
    const remeasure = () => frame.read(measureContent)

    /**
     * Observes the element while idle, and its children while animating.
     */
    const resizeObserver = new ResizeObserver(() =>
        isWatchingContent ? remeasure() : update(measure())
    )
    const mutationObserver = new MutationObserver(remeasure)

    const stopObserving = () => {
        resizeObserver.disconnect()
        mutationObserver.disconnect()
    }

    /**
     * Switch between observing the element and its content.
     */
    const observe = () => {
        const isAnimating = dimensions.some(isOwned)
        if (isAnimating === isWatchingContent) return
        isWatchingContent = isAnimating
        stopObserving()

        if (isAnimating) {
            for (const child of element.children) resizeObserver.observe(child)
            mutationObserver.observe(element, {
                childList: true,
                characterData: true,
                subtree: true,
            })
        } else {
            /**
             * Also picks up any size change missed while animating.
             */
            resizeObserver.observe(element)
        }
    }

    const finish = (dimension: Dimension) => {
        release(dimension)
        observe()
    }

    function update(size: Size) {
        const snap = axis === "y" && natural && size.width !== natural.width

        for (const dimension of dimensions) {
            const from = natural?.[dimension]
            const to = size[dimension]

            /**
             * Something else (like another animation) took over this
             * dimension, so let it.
             */
            if (style[dimension] !== written[dimension]) release(dimension)

            // Also catches sizes that can't be measured, like display: none
            if (snap || !(to >= 0)) {
                release(dimension)
                continue
            }

            let value = values[dimension]

            if (!isOwned(dimension)) {
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

                if (!value) {
                    value = values[dimension] = motionValue(from!)
                    value.on("change", (v) =>
                        style[dimension] === written[dimension]
                            ? write(dimension, v)
                            : finish(dimension)
                    )
                }
                value.jump(from!)
                restoreTo[dimension] = current

                /**
                 * Write the previous size before the browser paints the
                 * new one.
                 */
                write(dimension, from!)
            } else if (from === to) {
                continue
            }

            /**
             * A stopped (retargeted or released) animation never resolves.
             */
            value!
                .start(animateMotionValue(dimension, value!, to, transition))
                .then(() => finish(dimension))
        }

        natural = size
        observe()
    }

    resizeObserver.observe(element)

    return () => {
        stopObserving()
        dimensions.forEach(release)
    }
}
