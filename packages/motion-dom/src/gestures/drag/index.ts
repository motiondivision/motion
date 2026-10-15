import type { BoundingBox } from "motion-utils"
import type { InertiaOptions } from "../../animation/types"
import { acquireProjectionNode } from "../../layout/LayoutAnimationBuilder"
import type { MotionNodeOptions } from "../../node/types"
import type { VisualElement } from "../../render/VisualElement"
import {
    resolveElements,
    type ElementOrSelector,
} from "../../utils/resolve-elements"
import type { DragElastic, DragHandler } from "./types"
import { VisualElementDragControls } from "./VisualElementDragControls"

/**
 * @public
 */
export interface DragOptions {
    /**
     * Restrict dragging to a single axis. By default an element can be
     * dragged on both axes.
     */
    axis?: "x" | "y"

    /**
     * The permitted draggable area. Either `top`/`left`/`right`/`bottom`
     * distances in pixels, relative to the element's origin, or an element
     * the draggable element must stay within.
     */
    constraints?: Partial<BoundingBox> | Element

    /**
     * How far, from `0` to `1`, the element can move outside its
     * constraints. Can be set per edge. Defaults to `0.35`.
     */
    elastic?: DragElastic

    /**
     * Whether to carry the gesture's velocity into an inertia animation
     * on release. Defaults to `true`.
     */
    momentum?: boolean

    /**
     * Options for the inertia animation that runs on release.
     */
    transition?: InertiaOptions

    /**
     * Animate back to the origin on release.
     */
    snapToOrigin?: boolean | "x" | "y"

    /**
     * Lock dragging to the first axis the pointer moves along.
     */
    directionLock?: boolean

    /**
     * Allow drag gestures to start on parent elements that are also
     * draggable. By default, only the innermost draggable element moves.
     */
    propagation?: boolean

    onStart?: DragHandler
    onMove?: DragHandler
    onEnd?: DragHandler
    onDirectionLock?: (axis: "x" | "y") => void
    onTransitionEnd?: () => void

    /**
     * Called when element constraints are measured. Return a new
     * `BoundingBox` to override them.
     */
    onMeasureConstraints?: (constraints: BoundingBox) => BoundingBox | void
}

const toProps = ({
    axis,
    constraints,
    elastic,
    momentum,
    transition,
    snapToOrigin,
    directionLock,
    propagation,
    onStart,
    onMove,
    onEnd,
    onDirectionLock,
    onTransitionEnd,
    onMeasureConstraints,
}: DragOptions): MotionNodeOptions => ({
    drag: axis || true,
    dragConstraints: constraints,
    dragElastic: elastic,
    dragMomentum: momentum,
    dragTransition: transition,
    dragSnapToOrigin: snapToOrigin,
    dragDirectionLock: directionLock,
    dragPropagation: propagation,
    onDragStart: onStart,
    onDrag: onMove,
    onDragEnd: onEnd,
    onDirectionLock,
    onDragTransitionEnd: onTransitionEnd,
    onMeasureDragConstraints: onMeasureConstraints,
})

const dragStyles = [
    "user-select",
    "-webkit-user-select",
    "-webkit-touch-callout",
    "touch-action",
]

/**
 * Apply the styles React's drag prop applies, so touch input drags
 * instead of panning the page, and text selection and native drag (ghost
 * image) don't interrupt the gesture. Returns a function that restores
 * the element's previous values.
 */
function applyDragStyles(element: HTMLElement, axis?: "x" | "y") {
    const { style } = element
    const draggable = element.getAttribute("draggable")
    const prev = dragStyles.map((key) => style.getPropertyValue(key))
    const touchAction = axis ? "pan-" + (axis === "x" ? "y" : "x") : "none"

    dragStyles.forEach((key, i) =>
        style.setProperty(key, i < 3 ? "none" : touchAction)
    )
    element.setAttribute("draggable", "false")

    return () => {
        dragStyles.forEach((key, i) => style.setProperty(key, prev[i]))
        draggable === null
            ? element.removeAttribute("draggable")
            : element.setAttribute("draggable", draggable)
    }
}

/**
 * Make elements draggable. Returns a function that removes the gesture.
 *
 * ```javascript
 * const stop = drag("#box", { axis: "x", constraints: { left: 0, right: 300 } })
 * ```
 *
 * The element's `x` and `y` are motion values shared with `animate()`
 * and `animateLayout()`, so these can animate the element after a drag.
 *
 * @public
 */
export function drag(
    elementOrSelector: ElementOrSelector,
    options: DragOptions = {}
): VoidFunction {
    const props = toProps(options)

    const cleanups = resolveElements(elementOrSelector).map((element) => {
        const [node, release] = acquireProjectionNode(element as HTMLElement)

        /**
         * Measure layout even when not animating it, as constraints and
         * layout-shift correction are computed from it.
         */
        node.setOptions({ alwaysMeasureLayout: true })

        const controls = new VisualElementDragControls(
            node.options.visualElement as VisualElement<HTMLElement>,
            () => props
        )
        const removeListeners = controls.addListeners()
        const removeStyles = applyDragStyles(
            element as HTMLElement,
            options.axis
        )

        return () => {
            removeStyles()
            removeListeners?.()
            controls.cancel()
            release()
        }
    })

    return () => cleanups.forEach((cleanup) => cleanup())
}
