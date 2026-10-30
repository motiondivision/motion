import type { BoundingBox } from "motion-utils"
import type { InertiaOptions } from "../../animation/types"
import type { MotionNodeOptions } from "../../node/types"
import { visualElementStore } from "../../render/store"
import type { VisualElement } from "../../render/VisualElement"
import { activeScope, addToScope } from "../../scope/active"
import { motionValue, type MotionValue } from "../../value"
import {
    resolveElements,
    type ElementOrSelector,
} from "../../utils/resolve-elements"
import { acquireDragNode } from "./projection"
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

    /**
     * Motion values to write the drag to, instead of the element's
     * `x` and `y`. When either is set, the element itself doesn't move,
     * so drag can drive other values, like a dial's rotation.
     *
     * ```javascript
     * const x = motionValue(0)
     * x.on("change", (v) => (dial.style.rotate = v + "deg"))
     * drag(dial, { axis: "x", x })
     * ```
     */
    x?: MotionValue<number>
    y?: MotionValue<number>

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
    x,
    y,
}: DragOptions): MotionNodeOptions => ({
    drag: axis || true,
    ...((x || y) && {
        _dragX: x || motionValue(0),
        _dragY: y || motionValue(0),
    }),
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
    const scope = activeScope.current

    /**
     * Run callbacks in the active scope, so work they start is collected.
     */
    if (scope) {
        for (const key in props) {
            const value = props[key as keyof MotionNodeOptions]
            if (typeof value === "function") {
                ;(props as any)[key] = scope.bind(value)
            }
        }
    }

    const cleanups = resolveElements(elementOrSelector).map((element) => {
        scope?.track(element)
        const [node, release] = acquireDragNode(element as HTMLElement)

        /**
         * Measure layout even when not animating it, as constraints and
         * layout-shift correction are computed from it.
         */
        node.setOptions({ alwaysMeasureLayout: true })

        const controls = new VisualElementDragControls(
            visualElementStore.get(element) as VisualElement<HTMLElement>,
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
            controls.stopAnimation()
            release()
        }
    })

    return addToScope(() => cleanups.forEach((cleanup) => cleanup()))
}
