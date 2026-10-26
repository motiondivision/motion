import { Axis, invariant, Point } from "motion-utils"
import { animateMotionValue } from "../../animation/interfaces/motion-value"
import type { Transition } from "../../animation/types"
import { getVariableValue } from "../../animation/utils/css-variables-conversion"
import { isCSSVariableToken } from "../../animation/utils/is-css-variable"
import { addDomEvent } from "../../events/add-dom-event"
import { addPointerEvent } from "../../events/add-pointer-event"
import { frame } from "../../frameloop/frame"
import type { MotionNodeOptions } from "../../node/types"
import {
    convertBoundingBoxToBox,
    convertBoxToBoundingBox,
} from "../../projection/geometry/conversion"
import { calcLength } from "../../projection/geometry/delta-calc"
import { createBox } from "../../projection/geometry/models"
import type {
    IProjectionNode,
    LayoutUpdateData,
} from "../../projection/node/types"
import { eachAxis } from "../../projection/utils/each-axis"
import { measurePageBox } from "../../projection/utils/measure"
import type { VisualElement } from "../../render/VisualElement"
import { resize } from "../../resize"
import { mixNumber } from "../../utils/mix/number"
import { percent, px } from "../../value/types/numbers/units"
import { addValueToWillChange } from "../../value/will-change/add-will-change"
import type { PanInfo } from "../pan/types"
import { PanSession } from "../pan/PanSession"
import { isElementTextInput } from "../press/utils/is-keyboard-accessible"
import { setDragLock } from "./state/set-active"
import type { ResolvedConstraints } from "./types"
import {
    applyConstraints,
    calcOrigin,
    calcRelativeConstraints,
    calcViewportConstraints,
    defaultElastic,
    rebaseAxisConstraints,
    resolveDragElastic,
} from "./utils/constraints"

/**
 * Re-read the scroll of the projection's ancestors, and return that of the
 * `layoutScroll` ones as a key that changes when any of them scroll.
 *
 * Clear the cached scroll first so `updateScroll` bypasses its
 * per-animationId cache and re-reads the live value.
 */
function measureScroll(projection: IProjectionNode) {
    let key = ""

    for (const node of projection.path) {
        node.scroll = undefined
        node.updateScroll()

        const { scroll } = node as IProjectionNode
        if (node !== projection.root && scroll) {
            key += scroll.offset.x + "," + scroll.offset.y + ","
        }
    }

    return key
}

export const elementDragControls = new WeakMap<
    VisualElement,
    VisualElementDragControls
>()

export interface DragControlOptions {
    /**
     * This distance after which dragging starts and a direction is locked in.
     *
     * @public
     */
    distanceThreshold?: number

    /**
     * Whether to immediately snap to the cursor when dragging starts.
     *
     * @public
     */
    snapToCursor?: boolean
}

type DragDirection = "x" | "y"

export class VisualElementDragControls {
    private visualElement: VisualElement<HTMLElement>

    private panSession?: PanSession

    private openDragLock: VoidFunction | null = null

    isDragging = false
    private currentDirection: DragDirection | null = null

    private originPoint: Point = { x: 0, y: 0 }

    /**
     * The permitted boundaries of travel, in pixels.
     */
    private constraints: ResolvedConstraints | false = false

    private hasMutatedConstraints = false

    /**
     * The `layoutScroll` ancestors' scroll (see measureScroll) when ref
     * constraints were last measured.
     */
    private scroll?: string

    /**
     * The per-axis resolved elastic values.
     */
    private elastic = createBox()

    /**
     * The latest pointer event. Used as fallback when the `cancel` and `stop` functions are called without arguments.
     */
    private latestPointerEvent: PointerEvent | null = null

    /**
     * The latest pan info. Used as fallback when the `cancel` and `stop` functions are called without arguments.
     */
    private latestPanInfo: PanInfo | null = null

    /**
     * Where drag options are read from. By default these are the
     * VisualElement's props (as with a React `motion` component), but the
     * vanilla `drag()` API provides its own.
     */
    private readProps: () => MotionNodeOptions

    constructor(
        visualElement: VisualElement<HTMLElement>,
        readProps: () => MotionNodeOptions = () => visualElement.getProps()
    ) {
        this.visualElement = visualElement
        this.readProps = readProps
    }

    start(
        originEvent: PointerEvent,
        { snapToCursor = false, distanceThreshold }: DragControlOptions = {}
    ) {
        /**
         * Don't start dragging if this component is exiting
         */
        if (this.visualElement.presenceContext?.isPresent === false) return

        const onSessionStart = (event: PointerEvent) => {
            if (snapToCursor) this.snapToCursor(event)
            this.stopAnimation()
        }

        const onStart = (event: PointerEvent, info: PanInfo) => {
            // Attempt to grab the global drag gesture lock - maybe make this part of PanSession
            const { drag, dragPropagation, onDragStart } = this.getProps()

            if (drag && !dragPropagation) {
                this.openDragLock?.()

                this.openDragLock = setDragLock(drag)

                // If we don 't have the lock, don't start dragging
                if (!this.openDragLock) return
            }

            this.latestPointerEvent = event
            this.latestPanInfo = info
            this.isDragging = true

            this.currentDirection = null

            this.resolveConstraints()

            const { projection } = this.visualElement
            if (projection) {
                projection.isAnimationBlocked = true
                projection.target = undefined
            }

            /**
             * Record gesture origin and pointer offset
             */
            eachAxis((axis) => {
                let current = this.getAxisMotionValue(axis).get() || 0

                /**
                 * If the MotionValue is a CSS variable, like "var(--y)",
                 * resolve it so it can be converted to px below.
                 */
                if (isCSSVariableToken(current)) {
                    current =
                        getVariableValue(
                            current,
                            this.visualElement.current!
                        ) || 0
                }

                /**
                 * If the MotionValue is a px or percentage value convert to px
                 */
                if (px.test(current)) {
                    current = parseFloat(current)
                } else if (percent.test(current)) {
                    const measuredAxis = projection?.layout?.layoutBox[axis]

                    if (measuredAxis) {
                        current =
                            calcLength(measuredAxis) *
                            (parseFloat(current) / 100)
                    }
                }

                this.originPoint[axis] = current
            })

            // Fire onDragStart event
            if (onDragStart) {
                frame.update(() => onDragStart(event, info), false, true)
            }

            addValueToWillChange(this.visualElement, "transform")

            this.visualElement.animationState?.setActive("whileDrag", true)
        }

        const onMove = (event: PointerEvent, info: PanInfo) => {
            this.latestPointerEvent = event
            this.latestPanInfo = info

            const {
                dragPropagation,
                dragDirectionLock,
                onDirectionLock,
                onDrag,
            } = this.getProps()

            // If we didn't successfully receive the gesture lock, early return.
            if (!dragPropagation && !this.openDragLock) return

            const { offset } = info
            // Attempt to detect drag direction if directionLock is true
            if (dragDirectionLock && this.currentDirection === null) {
                this.currentDirection = getCurrentDirection(offset)

                /**
                 * Wait for more movement until a direction is set. Once
                 * it is, apply this move too: it can be the last before
                 * release when the browser coalesces a fast gesture.
                 */
                if (this.currentDirection === null) return

                onDirectionLock && onDirectionLock(this.currentDirection)
            }

            // Update each point with the latest position
            this.updateAxis("x", offset)
            this.updateAxis("y", offset)

            /**
             * Ideally we would leave the renderer to fire naturally at the end of
             * this frame but if the element is about to change layout as the result
             * of a re-render we want to ensure the browser can read the latest
             * bounding box to ensure the pointer and element don't fall out of sync.
             */
            this.visualElement.render()

            /**
             * This must fire after the render call as it might trigger a state
             * change which itself might trigger a layout update.
             */
            if (onDrag) {
                frame.update(() => onDrag(event, info), false, true)
            }
        }

        const onSessionEnd = (event: PointerEvent, info: PanInfo) => {
            this.latestPointerEvent = event
            this.latestPanInfo = info

            this.stop(event, info)

            this.latestPointerEvent = null
            this.latestPanInfo = null
        }

        const resumeAnimation = () => {
            const { dragSnapToOrigin: snap } = this.getProps()
            if (snap || this.constraints) {
                this.startAnimation({ x: 0, y: 0 })
            }
        }

        const { dragSnapToOrigin } = this.getProps()
        this.panSession = new PanSession(
            originEvent,
            {
                onSessionStart,
                onStart,
                onMove,
                onSessionEnd,
                resumeAnimation,
            },
            {
                transformPagePoint: this.visualElement.getTransformPagePoint(),
                dragSnapToOrigin,
                distanceThreshold,
                contextWindow:
                    this.visualElement.current?.ownerDocument.defaultView,
                element: this.visualElement.current,
            }
        )
    }

    /**
     * @param dragAxes - The axes to animate on release, if not the `drag`
     * prop's, e.g. when drag was disabled mid-gesture.
     */
    stop(
        event?: PointerEvent,
        panInfo?: PanInfo,
        dragAxes?: MotionNodeOptions["drag"]
    ) {
        const finalEvent = event || this.latestPointerEvent
        const finalPanInfo = panInfo || this.latestPanInfo

        const isDragging = this.isDragging
        this.cancel()
        if (!isDragging || !finalPanInfo || !finalEvent) return

        const { velocity } = finalPanInfo
        this.startAnimation(velocity, dragAxes)

        const { onDragEnd } = this.getProps()
        if (onDragEnd) {
            frame.postRender(() => onDragEnd(finalEvent, finalPanInfo))
        }
    }

    cancel() {
        this.isDragging = false

        const { projection, animationState } = this.visualElement

        if (projection) {
            projection.isAnimationBlocked = false
        }

        this.endPanSession()

        if (!this.getProps().dragPropagation && this.openDragLock) {
            this.openDragLock()
            this.openDragLock = null
        }

        animationState?.setActive("whileDrag", false)
    }

    /**
     * Clean up the pan session without modifying other drag state.
     * This is used during unmount to ensure event listeners are removed
     * without affecting projection animations or drag locks.
     */
    endPanSession() {
        this.panSession?.end()
        this.panSession = undefined
    }

    private updateAxis(axis: DragDirection, offset?: Point) {
        /**
         * Read drag per axis: a callback fired while updating the x axis
         * can synchronously re-render with new props.
         */
        const { drag } = this.readProps()

        // If we're not dragging this axis, do an early return.
        if (!offset || !shouldDrag(axis, drag, this.currentDirection)) return

        const axisValue = this.getAxisMotionValue(axis)
        let next = this.originPoint[axis] + offset[axis]

        // Apply constraints
        const constraints = this.constraints && this.constraints[axis]
        if (constraints) {
            next = applyConstraints(next, constraints, this.elastic[axis])
        }

        axisValue.set(next)
    }

    private resolveConstraints() {
        const { dragConstraints, dragElastic } = this.getProps()

        const { projection } = this.visualElement
        const layout =
            projection && (projection.layout || projection.measure(false))

        const prevConstraints = this.constraints

        if (isElementConstraints(dragConstraints)) {
            /**
             * Ref constraints are measured with the layout. Scrolling a
             * `layoutScroll` ancestor since can move the element relative
             * to them without a layout measurement, so measure them again
             * (#2024). Otherwise keep them: they and the layout can both
             * have moved on the page since, e.g. when content above grows.
             */
            if (
                !this.constraints ||
                this.scroll !== measureScroll(projection!)
            ) {
                this.constraints = this.resolveRefConstraints()
            }
        } else {
            if (dragConstraints && layout) {
                this.constraints = calcRelativeConstraints(
                    layout.layoutBox,
                    dragConstraints
                )
            } else {
                this.constraints = false
            }
        }

        this.elastic = resolveDragElastic(dragElastic)

        /**
         * If we're outputting to external MotionValues, we want to rebase the measured constraints
         * from viewport-relative to component-relative. This only applies to relative (non-ref)
         * constraints, as ref-based constraints from calcViewportConstraints are already in the
         * correct coordinate space for the motion value transform offset.
         */
        if (
            prevConstraints !== this.constraints &&
            !isElementConstraints(dragConstraints) &&
            layout &&
            this.constraints &&
            !this.hasMutatedConstraints
        ) {
            eachAxis((axis) => {
                if (
                    this.constraints !== false &&
                    this.getAxisMotionValue(axis)
                ) {
                    this.constraints[axis] = rebaseAxisConstraints(
                        layout.layoutBox[axis],
                        this.constraints[axis]
                    )
                }
            })
        }
    }

    private resolveRefConstraints() {
        const { dragConstraints: constraints, onMeasureDragConstraints } =
            this.getProps()
        if (!isElementConstraints(constraints)) return false

        const constraintsElement = resolveConstraintsElement(constraints)

        invariant(
            !!constraintsElement,
            "If `dragConstraints` is set as a React ref, that ref must be passed to another component's `ref` prop.",
            "drag-constraints-ref"
        )

        const { projection } = this.visualElement

        // TODO
        if (!projection || !projection.layout) return false

        /**
         * Refresh the scroll offsets of the root and `layoutScroll`
         * ancestors so the constraint's viewport box translates to the
         * layout's coordinates. The scroll captured when the layout was
         * measured can be stale if they've scrolled since — e.g. via the
         * browser restoring scroll on refresh, or an ancestor layout effect
         * running after this element's mount (#2829).
         */
        this.scroll = measureScroll(projection)

        const constraintsBox = measurePageBox(
            constraintsElement as HTMLElement,
            projection.root!,
            this.visualElement.getTransformPagePoint()
        )

        /**
         * layoutBox removes the scroll of `layoutScroll` ancestors, so
         * remove it from the constraints box too.
         */
        let measuredConstraints = calcViewportConstraints(
            projection.layout.layoutBox,
            projection.removeElementScroll(constraintsBox)
        )

        /**
         * If there's an onMeasureDragConstraints listener we call it and
         * if different constraints are returned, set constraints to that
         */
        if (onMeasureDragConstraints) {
            const userConstraints = onMeasureDragConstraints(
                convertBoxToBoundingBox(measuredConstraints)
            )

            this.hasMutatedConstraints = !!userConstraints

            if (userConstraints) {
                measuredConstraints = convertBoundingBoxToBox(userConstraints)
            }
        }

        return measuredConstraints
    }

    private startAnimation(
        velocity: Point,
        dragAxes?: MotionNodeOptions["drag"]
    ) {
        const {
            drag,
            dragMomentum,
            dragElastic,
            dragTransition,
            dragSnapToOrigin,
            onDragTransitionEnd,
        } = this.getProps()

        const constraints: Partial<ResolvedConstraints> = this.constraints || {}

        const momentumAnimations = eachAxis((axis) => {
            if (!shouldDrag(axis, dragAxes || drag, this.currentDirection)) {
                return
            }

            let transition = constraints[axis] || {}

            if (
                dragSnapToOrigin === true ||
                (dragSnapToOrigin as unknown) === axis
            )
                transition = { min: 0, max: 0 }

            /**
             * Overdamp the boundary spring if `dragElastic` is disabled. There's still a frame
             * of spring animations so we should look into adding a disable spring option to `inertia`.
             * We could do something here where we affect the `bounceStiffness` and `bounceDamping`
             * using the value of `dragElastic`.
             */
            const bounceStiffness = dragElastic ? 200 : 1000000
            const bounceDamping = dragElastic ? 40 : 10000000

            const inertia: Transition = {
                type: "inertia",
                velocity: dragMomentum ? velocity[axis] : 0,
                bounceStiffness,
                bounceDamping,
                timeConstant: 750,
                restDelta: 1,
                restSpeed: 10,
                ...dragTransition,
                ...transition,
            }

            // If we're not animating on an externally-provided `MotionValue` we can use the
            // component's animation controls which will handle interactions with whileHover (etc),
            // otherwise we just have to animate the `MotionValue` itself.
            return this.startAxisValueAnimation(axis, inertia)
        })

        // Run all animations and then resolve the new drag constraints.
        return Promise.all(momentumAnimations).then(onDragTransitionEnd)
    }

    private startAxisValueAnimation(
        axis: DragDirection,
        transition: Transition
    ) {
        const axisValue = this.getAxisMotionValue(axis)

        addValueToWillChange(this.visualElement, axis)

        return axisValue.start(
            animateMotionValue(
                axis,
                axisValue,
                0,
                transition,
                this.visualElement,
                false
            )
        )
    }

    stopAnimation() {
        eachAxis((axis) => this.getAxisMotionValue(axis).stop())
    }

    /**
     * Drag works differently depending on which props are provided.
     *
     * - If _dragX and _dragY are provided, we output the gesture delta directly to those motion values.
     * - Otherwise, we apply the delta to the x/y motion values.
     */
    private getAxisMotionValue(axis: DragDirection) {
        const dragKey =
            `_drag${axis.toUpperCase()}` as `_drag${Uppercase<DragDirection>}`
        const props = this.readProps()
        const externalMotionValue = props[dragKey]

        return externalMotionValue
            ? externalMotionValue
            : this.visualElement.getValue(
                  axis,
                  this.visualElement.latestValues[axis] ?? 0
              )
    }

    /**
     * Measure the live box - projection.layout may or may not include the
     * drag transform, depending on when it was measured.
     */
    private snapToCursor({ clientX, clientY }: PointerEvent) {
        const { drag } = this.getProps()
        const point = { x: clientX, y: clientY }
        const cursor =
            this.visualElement.getTransformPagePoint()?.(point) || point
        const box = this.visualElement.measureViewportBox()

        eachAxis((axis) => {
            if (!shouldDrag(axis, drag, this.currentDirection)) return

            const axisValue = this.getAxisMotionValue(axis)
            const { min, max } = box[axis]

            axisValue.set(
                (axisValue.get() || 0) + cursor[axis] - mixNumber(min, max, 0.5)
            )
        })
    }

    /**
     * When the viewport resizes we want to check if the measured constraints
     * have changed and, if so, reposition the element within those new constraints
     * relative to where it was before the resize.
     */
    scalePositionWithinConstraints() {
        if (!this.visualElement.current) return

        const { drag, dragConstraints } = this.getProps()
        const { projection } = this.visualElement
        if (
            !isElementConstraints(dragConstraints) ||
            !projection ||
            !this.constraints
        )
            return

        /**
         * Stop current animations as there can be visual glitching if we try to do
         * this mid-animation
         */
        this.stopAnimation()

        /**
         * Record the relative position of the dragged element relative to the
         * constraints box and save as a progress value.
         */
        const constraints = this.constraints as ResolvedConstraints
        const boxProgress = { x: 0, y: 0 }
        eachAxis((axis) => {
            const latest = this.getAxisMotionValue(axis).get()
            boxProgress[axis] = calcOrigin(
                { min: latest, max: latest },
                constraints[axis] as Axis
            )
        })

        /**
         * Update the layout of this element and resolve the latest drag constraints
         */
        const { transformTemplate } = this.visualElement.getProps()
        this.visualElement.current.style.transform = transformTemplate
            ? transformTemplate({}, "")
            : "none"
        projection.root?.updateScroll()
        projection.updateLayout()

        /**
         * Reset constraints so resolveConstraints() will recalculate them
         * with the freshly measured layout rather than returning the cached value.
         */
        this.constraints = false
        this.resolveConstraints()

        /**
         * For each axis, calculate the current progress of the layout axis
         * within the new constraints.
         */
        eachAxis((axis) => {
            const axisValue = this.getAxisMotionValue(axis)

            /**
             * An element resting at its origin has no offset to preserve,
             * and re-projecting 0 into the new constraints would move it.
             */
            if (!shouldDrag(axis, drag, null) || !axisValue.get()) return

            /**
             * Calculate a new transform based on the previous box progress
             */
            const { min, max } = (this.constraints as ResolvedConstraints)[
                axis
            ] as Axis
            axisValue.set(mixNumber(min, max, boxProgress[axis]))
        })

        /**
         * Flush the updated transform to the DOM synchronously to prevent
         * a visual flash at the element's CSS layout position (0,0) when
         * the transform was stripped for measurement.
         */
        this.visualElement.render()
    }

    addListeners() {
        if (!this.visualElement.current) return
        elementDragControls.set(this.visualElement, this)
        const element = this.visualElement.current

        /**
         * Attach a pointerdown event listener on this DOM element to initiate drag tracking.
         */
        const stopPointerListener = addPointerEvent(
            element,
            "pointerdown",
            (event) => {
                const { drag, dragListener = true } = this.getProps()
                const target = event.target as Element

                /**
                 * Only block drag if clicking on a text input child element
                 * (input, textarea, select, contenteditable) where users might
                 * want to select text or interact with the control.
                 *
                 * Buttons and links don't block drag since they don't have
                 * click-and-move actions of their own.
                 */
                const isClickingTextInputChild =
                    target !== element && isElementTextInput(target)

                if (drag && dragListener && !isClickingTextInputChild) {
                    this.start(event)
                }
            }
        )

        /**
         * If using ref-based constraints, observe both the draggable element
         * and the constraint container for size changes via ResizeObserver.
         * Setup is deferred because dragConstraints.current is null when
         * addListeners first runs (React hasn't committed the ref yet).
         */
        let stopResizeObservers: VoidFunction | undefined

        const measureDragConstraints = () => {
            const { dragConstraints } = this.getProps()
            const constraintsElement =
                isElementConstraints(dragConstraints) &&
                resolveConstraintsElement(dragConstraints)

            if (constraintsElement) {
                this.constraints = this.resolveRefConstraints()

                if (!stopResizeObservers) {
                    stopResizeObservers = startResizeObservers(
                        element,
                        constraintsElement as HTMLElement,
                        () => this.scalePositionWithinConstraints()
                    )
                }
            }
        }

        const { projection } = this.visualElement

        const stopMeasureLayoutListener = projection!.addEventListener(
            "measure",
            measureDragConstraints
        )

        if (!projection!.layout) {
            projection!.root?.updateScroll()
            projection!.updateLayout()
        }

        frame.read(measureDragConstraints)

        /**
         * Attach a window resize listener to scale the draggable target within its defined
         * constraints as the window resizes.
         */
        const stopResizeListener = addDomEvent(window, "resize", () =>
            this.scalePositionWithinConstraints()
        )

        /**
         * If the element's layout changes, calculate the delta and apply that to
         * the drag gesture's origin point.
         */
        const stopLayoutUpdateListener = projection!.addEventListener(
            "didUpdate",
            (({ delta, hasLayoutChanged }: LayoutUpdateData) => {
                if (this.isDragging && hasLayoutChanged) {
                    eachAxis((axis) => {
                        /**
                         * Only compensate axes this gesture drags. A
                         * non-drag axis follows its layout instead, as
                         * nothing would ever move it back (e.g. snapping
                         * to origin only animates drag axes).
                         */
                        if (
                            !shouldDrag(
                                axis,
                                this.getProps().drag,
                                this.currentDirection
                            )
                        )
                            return

                        const motionValue = this.getAxisMotionValue(axis)
                        this.originPoint[axis] += delta[axis].translate
                        motionValue.set(
                            motionValue.get() + delta[axis].translate
                        )
                    })

                    this.visualElement.render()
                }
            }) as any
        )

        return () => {
            stopResizeListener()
            stopPointerListener()
            stopMeasureLayoutListener()
            stopLayoutUpdateListener()
            stopResizeObservers?.()
        }
    }

    getProps(): MotionNodeOptions {
        const props = this.readProps()
        const { dragElastic = defaultElastic, dragMomentum = true } = props
        return { ...props, dragElastic, dragMomentum }
    }
}

type ConstraintsElement = Element | { current: Element | null }

/**
 * `dragConstraints` can be an element, or a ref (`{ current }`) to one.
 */
function isElementConstraints(
    constraints: MotionNodeOptions["dragConstraints"]
): constraints is ConstraintsElement {
    return (
        !!constraints &&
        typeof constraints === "object" &&
        ("current" in constraints || "nodeType" in constraints)
    )
}

const resolveConstraintsElement = (constraints: ConstraintsElement) =>
    "current" in constraints ? constraints.current : constraints

function skipFirstCall(callback: VoidFunction): VoidFunction {
    let isFirst = true
    return () => {
        if (isFirst) {
            isFirst = false
            return
        }
        callback()
    }
}

function startResizeObservers(
    element: HTMLElement,
    constraintsElement: HTMLElement,
    onResize: VoidFunction
): VoidFunction {
    const stopElement = resize(element, skipFirstCall(onResize))
    const stopContainer = resize(constraintsElement, skipFirstCall(onResize))
    return () => {
        stopElement()
        stopContainer()
    }
}

function shouldDrag(
    direction: DragDirection,
    drag: boolean | DragDirection | undefined,
    currentDirection: null | DragDirection
) {
    return (
        (drag === true || drag === direction) &&
        (currentDirection === null || currentDirection === direction)
    )
}

/**
 * Based on an x/y offset determine the current drag direction. If both axis' offsets are lower
 * than the provided threshold, return `null`.
 *
 * @param offset - The x/y offset from origin.
 * @param lockThreshold - (Optional) - the minimum absolute offset before we can determine a drag direction.
 */
function getCurrentDirection(
    offset: Point,
    lockThreshold = 10
): DragDirection | null {
    let direction: DragDirection | null = null

    if (Math.abs(offset.y) > lockThreshold) {
        direction = "y"
    } else if (Math.abs(offset.x) > lockThreshold) {
        direction = "x"
    }

    return direction
}

export function expectsResolvedDragConstraints({
    dragConstraints,
    onMeasureDragConstraints,
}: MotionNodeOptions) {
    return isElementConstraints(dragConstraints) && !!onMeasureDragConstraints
}
