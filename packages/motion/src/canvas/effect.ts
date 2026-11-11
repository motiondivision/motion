import {
    createEffect,
    styleEffect,
    type MotionValueState,
} from "framer-motion/dom"
import { canvasItems } from "./layer"

/**
 * Binds motion values to an element drawn by a canvas layer, as
 * `styleEffect` binds them to an element's style. Keys are the layer's
 * values (`x`, `rotate`, `opacity` etc) and the element's shader uniforms.
 *
 * ```javascript
 * const progress = scroll()
 * canvasEffect(card, { x, progress })
 * ```
 *
 * `animate()` and `drag()` already animate elements in a layer through
 * the layer, so this is only for motion values made elsewhere. Returns a
 * function that unbinds them, leaving the element where it is. An
 * element that isn't in a layer, as in a browser without HTML-in-canvas,
 * gets them as styles.
 */
export const canvasEffect = createEffect<HTMLElement>(
    (element, state: MotionValueState, key, value) => {
        const visualElement = canvasItems.get(element)?.visualElement
        if (!visualElement) return styleEffect(element, { [key]: value })

        visualElement.addValue(key, value)
        const remove = state.set(key, value)

        /**
         * Unbinding leaves the element where it is, as styleEffect leaves
         * the last style it wrote.
         */
        return () => {
            remove()
            if (visualElement.getValue(key) === value) {
                visualElement.removeValue(key)
                visualElement.setStaticValue(key, value.get())
            }
        }
    },
    {
        test: (subject): subject is HTMLElement =>
            canvasItems.has(subject as Element),
        read: (element, key) =>
            canvasItems.get(element)?.visualElement.readValue(key) ?? undefined,
    }
)
