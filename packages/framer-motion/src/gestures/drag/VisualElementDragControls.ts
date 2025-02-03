import { invariant } from "motion-utils"
import { setDragLock } from "motion-dom"
import { PanSession, PanInfo } from "../pan/PanSession"
import { ResolvedConstraints } from "./types"
import { isRefObject } from "../../utils/is-ref-object"
import { addPointerEvent } from "../../events/add-pointer-event"
import {
    calcRelativeConstraints,
    calcViewportConstraints,
    applyConstraints,
    rebaseAxisConstraints,
    resolveDragElastic,
    defaultElastic,
    calcOrigin,
} from "./utils/constraints"
import type { VisualElement } from "../../render/VisualElement"
import { MotionProps } from "../../motion/types"
import { Axis, Point } from "../../projection/geometry/types"
import { createBox } from "../../projection/geometry/models"
import { eachAxis } from "../../projection/utils/each-axis"
import { measurePageBox } from "../../projection/utils/measure"
import { extractEventInfo } from "../../events/event-info"
import { Transition } from "../../types"
import {
    convertBoundingBoxToBox,
    convertBoxToBoundingBox,
} from "../../projection/geometry/conversion"
import { LayoutUpdateData } from "../../projection/node/types"
import { addDomEvent } from "../../events/add-dom-event"
import { calcLength } from "../../projection/geometry/delta-calc"
import { mixNumber } from "../../utils/mix/number"
import { percent } from "../../value/types/numbers/units"
import { animateMotionValue } from "../../animation/interfaces/motion-value"
import { getContextWindow } from "../../utils/get-context-window"
import { frame } from "../../frameloop"
import { addValueToWillChange } from "../../value/use-will-change/add-will-change"

export const elementDragControls = new WeakMap<
    VisualElement,
    VisualElementDragControls
>()

export interface DragControlOptions {
    snapToCursor?: boolean
    cursorProgress?: Point
}

type DragDirection = "x" | "y"

/**
 *
 */
// let latestPointerEvent: PointerEvent

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
     * The per-axis resolved elastic values.
     */
    private elastic = createBox()

    constructor(visualElement: VisualElement<HTMLElement>) {
        this.visualElement = visualElement
    }

    start(
        originEvent: PointerEvent,
        { snapToCursor = false }: DragControlOptions = {}
    ) {
        /**
         * Don't start dragging if this component is exiting
         */
        const { presenceContext } = this.visualElement
        if (presenceContext && presenceContext.isPresent === false) return

        const onSessionStart = (event: PointerEvent) => {
            const { dragSnapToOrigin, dragConstraints } = this.getProps()

            // Stop or pause any animations on both axis values immediately when not using dragConstraints.
            // This allows the user to throw and catch the component.
            if (!dragConstraints) {
                dragSnapToOrigin ? this.pauseAnimation() : this.stopAnimation()
            }

            if (snapToCursor) {
                this.snapToCursor(extractEventInfo(event).point)
            }
        }

        const onStart = (event: PointerEvent, info: PanInfo) => {
            // Attempt to grab the global drag gesture lock - maybe make this part of PanSession
            const { drag, dragPropagation, onDragStart } = this.getProps()

            if (drag && !dragPropagation) {
                if (this.openDragLock) this.openDragLock()

                this.openDragLock = setDragLock(drag)

                // If we don 't have the lock, don't start dragging
                if (!this.openDragLock) return
            }

            this.isDragging = true

            this.currentDirection = null

            this.resolveConstraints()

            if (this.visualElement.projection) {
                this.visualElement.projection.isAnimationBlocked = true
                this.visualElement.projection.target = undefined
            }

            /**
             * Record gesture origin
             */
            eachAxis((axis) => {
                let current = this.getAxisMotionValue(axis).get() || 0

                /**
                 * If the MotionValue is a percentage value convert to px
                 */
                if (percent.test(current)) {
                    const { projection } = this.visualElement

                    if (projection && projection.layout) {
                        const measuredAxis = projection.layout.layoutBox[axis]

                        if (measuredAxis) {
                            const length = calcLength(measuredAxis)
                            current = length * (parseFloat(current) / 100)
                        }
                    }
                }

                this.originPoint[axis] = current
            })

            // Fire onDragStart event
            if (onDragStart) {
                frame.postRender(() => onDragStart(event, info))
            }

            addValueToWillChange(this.visualElement, "transform")

            const { animationState } = this.visualElement
            animationState && animationState.setActive("whileDrag", true)
        }

        const onMove = (event: PointerEvent, info: PanInfo) => {
            // latestPointerEvent = event

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

                // If we've successfully set a direction, notify listener
                if (this.currentDirection !== null) {
                    onDirectionLock && onDirectionLock(this.currentDirection)
                }

                return
            }

            // Update each point with the latest position
            this.updateAxis("x", info.point, offset)
            this.updateAxis("y", info.point, offset)

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
            onDrag && onDrag(event, info)
        }

        const onSessionEnd = (event: PointerEvent, info: PanInfo) =>
            this.stop(event, info)

        const resumeAnimation = () =>
            eachAxis(
                (axis) =>
                    this.getAnimationState(axis) === "paused" &&
                    this.getAxisMotionValue(axis).animation?.play()
            )

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
                contextWindow: getContextWindow(this.visualElement),
            }
        )
    }

    private stop(event: PointerEvent, info: PanInfo) {
        const isDragging = this.isDragging
        this.cancel()
        if (!isDragging) return

        const { velocity } = info
        this.startAnimation(velocity)

        const { onDragEnd } = this.getProps()
        if (onDragEnd) {
            frame.postRender(() => onDragEnd(event, info))
        }
    }

    private cancel() {
        this.isDragging = false
        const { projection, animationState } = this.visualElement
        if (projection) {
            projection.isAnimationBlocked = false
        }
        this.panSession && this.panSession.end()
        this.panSession = undefined

        const { dragPropagation } = this.getProps()
        if (!dragPropagation && this.openDragLock) {
            this.openDragLock()
            this.openDragLock = null
        }

        animationState && animationState.setActive("whileDrag", false)
    }

    private updateAxis(axis: DragDirection, _point: Point, offset?: Point) {
        const { drag } = this.getProps()

        // If we're not dragging this axis, do an early return.
        if (!offset || !shouldDrag(axis, drag, this.currentDirection)) return

        const axisValue = this.getAxisMotionValue(axis)
        let next = this.originPoint[axis] + offset[axis]

        // Apply constraints
        if (this.constraints && this.constraints[axis]) {
            next = applyConstraints(
                next,
                this.constraints[axis],
                this.elastic[axis]
            )
        }

        axisValue.set(next)
    }

    private resolveConstraints() {
        const { dragConstraints, dragElastic } = this.getProps()

        const layout =
            this.visualElement.projection &&
            !this.visualElement.projection.layout
                ? this.visualElement.projection.measure(false)
                : this.visualElement.projection?.layout

        const prevConstraints = this.constraints

        if (dragConstraints && isRefObject(dragConstraints)) {
            if (!this.constraints) {
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
         * from viewport-relative to component-relative.
         */
        if (
            prevConstraints !== this.constraints &&
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
        if (!constraints || !isRefObject(constraints)) return false

        const constraintsElement = constraints.current as HTMLElement

        invariant(
            constraintsElement !== null,
            "If `dragConstraints` is set as a React ref, that ref must be passed to another component's `ref` prop."
        )

        const { projection } = this.visualElement

        // TODO
        if (!projection || !projection.layout) return false

        const constraintsBox = measurePageBox(
            constraintsElement,
            projection.root!,
            this.visualElement.getTransformPagePoint()
        )

        let measuredConstraints = calcViewportConstraints(
            projection.layout.layoutBox,
            constraintsBox
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

    private startAnimation(velocity: Point) {
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
            if (!shouldDrag(axis, drag, this.currentDirection)) {
                return
            }

            let transition = (constraints && constraints[axis]) || {}

            if (dragSnapToOrigin) transition = { min: 0, max: 0 }

            /**
             * Overdamp the boundary spring if `dragElastic` is disabled. There's still a frame
             * of spring animations so we should look into adding a disable spring option to `inertia`.
             * We could do something here where we affect the `bounceStiffness` and `bounceDamping`
             * using the value of `dragElastic`.
             */
            const bounceStiffness = dragElastic ? 200 : 1000000
            const bounceDamping = dragElastic ? 40 : 10000000

            const inertia = {
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

    private stopAnimation() {
        eachAxis((axis) => this.getAxisMotionValue(axis).stop())
    }

    private pauseAnimation() {
        eachAxis((axis) => this.getAxisMotionValue(axis).animation?.pause())
    }

    private getAnimationState(axis: DragDirection) {
        return this.getAxisMotionValue(axis).animation?.state
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
        const props = this.visualElement.getProps()
        const externalMotionValue = props[dragKey]

        return externalMotionValue
            ? externalMotionValue
            : this.visualElement.getValue(
                  axis,
                  (props.initial
                      ? props.initial[axis as keyof typeof props.initial]
                      : undefined) || 0
              )
    }

    private snapToCursor(point: Point) {
        eachAxis((axis) => {
            const { drag } = this.getProps()

            // If we're not dragging this axis, do an early return.
            if (!shouldDrag(axis, drag, this.currentDirection)) return

            const { projection } = this.visualElement
            const axisValue = this.getAxisMotionValue(axis)

            if (projection && projection.layout) {
                const { min, max } = projection.layout.layoutBox[axis]

                axisValue.set(point[axis] - mixNumber(min, max, 0.5))
            }
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
        if (!isRefObject(dragConstraints) || !projection || !this.constraints)
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
        const boxProgress = { x: 0, y: 0 }
        eachAxis((axis) => {
            const axisValue = this.getAxisMotionValue(axis)
            if (axisValue && this.constraints !== false) {
                const latest = axisValue.get()
                boxProgress[axis] = calcOrigin(
                    { min: latest, max: latest },
                    this.constraints[axis] as Axis
                )
            }
        })

        /**
         * Update the layout of this element and resolve the latest drag constraints
         */
        const { transformTemplate } = this.visualElement.getProps()
        this.visualElement.current.style.transform = transformTemplate
            ? transformTemplate({}, "")
            : "none"
        projection.root && projection.root.updateScroll()
        projection.updateLayout()
        this.resolveConstraints()

        /**
         * For each axis, calculate the current progress of the layout axis
         * within the new constraints.
         */
        eachAxis((axis) => {
            if (!shouldDrag(axis, drag, null)) return

            /**
             * Calculate a new transform based on the previous box progress
             */
            const axisValue = this.getAxisMotionValue(axis)
            const { min, max } = (this.constraints as ResolvedConstraints)[
                axis
            ] as Axis
            axisValue.set(mixNumber(min, max, boxProgress[axis]))
        })
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
                drag && dragListener && this.start(event)
            }
        )

        const measureDragConstraints = () => {
            const { dragConstraints } = this.getProps()
            if (isRefObject(dragConstraints) && dragConstraints.current) {
                this.constraints = this.resolveRefConstraints()
            }
        }

        const { projection } = this.visualElement

        const stopMeasureLayoutListener = projection!.addEventListener(
            "measure",
            measureDragConstraints
        )

        if (projection && !projection!.layout) {
            projection.root && projection.root.updateScroll()
            projection.updateLayout()
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
                        const motionValue = this.getAxisMotionValue(axis)
                        if (!motionValue) return

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
            stopLayoutUpdateListener && stopLayoutUpdateListener()
        }
    }

    getProps(): MotionProps {
        const props = this.visualElement.getProps()
        const {
            drag = false,
            dragDirectionLock = false,
            dragPropagation = false,
            dragConstraints = false,
            dragElastic = defaultElastic,
            dragMomentum = true,
        } = props
        return {
            ...props,
            drag,
            dragDirectionLock,
            dragPropagation,
            dragConstraints,
            dragElastic,
            dragMomentum,
        }
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
}: MotionProps) {
    return isRefObject(dragConstraints) && !!onMeasureDragConstraints
}
