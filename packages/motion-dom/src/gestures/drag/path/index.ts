import type { Point } from "motion-utils"
import { inertia } from "../../../animation/generators/inertia"
import { spring } from "../../../animation/generators/spring"
import { JSAnimation } from "../../../animation/JSAnimation"
import type { VisualElement } from "../../../render/VisualElement"
import type { DragConstraintsFunction, DragPointConstraint } from "../types"
import { flattenPath } from "./parse"
import { createPathSolver, createRing, type Ring } from "./solver"

export interface PathConstraintsOptions {
    /**
     * Hold the element on the path's line, rather than within the area
     * it encloses.
     */
    stroke?: boolean

    /**
     * How far, in pixels, the element can slide away from the pointer to
     * round a corner and reach a point nearer it. Defaults to `20`.
     *
     * The element never jumps a gap or a wall to reach the pointer, but
     * this lets it follow a pointer that cuts a corner.
     */
    forgiveness?: number
}

type PathElement = SVGGeometryElement

export type PathTarget =
    | string
    | PathElement
    | { current: PathElement | null }
    | Point[]

/**
 * Sample a basic shape (`<circle>`, `<rect>`...) along its outline. These
 * are a single subpath of few segments, which `getPointAtLength()` measures
 * quickly.
 */
function sampleShape(shape: PathElement, step: number): [number[], boolean] {
    const length = shape.getTotalLength()
    const count = Math.min(2000, Math.ceil(length / step))
    const points: number[] = []

    for (let i = 0; i <= count; i++) {
        const { x, y } = shape.getPointAtLength((i * length) / count)
        points.push(x, y)
    }

    return [points, false]
}

/**
 * A path's outline as polylines, one per subpath, in the draggable's
 * `x`/`y` space.
 */
function measureRings(
    target: Exclude<PathTarget, Point[]>,
    visualElement: VisualElement<HTMLElement>,
    origin: Point,
    stroke: boolean
): Ring[] {
    let subpaths: Array<[number[], boolean]>
    let matrix: DOMMatrix | null = null
    let offsetX = 0
    let offsetY = 0

    if (typeof target === "string") {
        /**
         * Path data is in the draggable's own space, where 0, 0 is where
         * it sits when `x` and `y` are `0`.
         */
        subpaths = flattenPath(target, 2)
    } else {
        const element = "current" in target ? target.current! : target

        /**
         * Map the outline into the viewport, then into the draggable's
         * `x`/`y` space via its centre, as that's what's constrained.
         */
        matrix = element.getScreenCTM()!
        const { x, y } = visualElement.measureViewportBox()
        offsetX = (x.min + x.max) / 2 - origin.x
        offsetY = (y.min + y.max) / 2 - origin.y

        // Steps of about 2px on screen
        const step = 2 / (Math.hypot(matrix.a, matrix.b) || 1)
        subpaths =
            element.tagName === "path"
                ? flattenPath(element.getAttribute("d") || "", step)
                : [sampleShape(element, step)]
    }

    const transformPoint = visualElement.getTransformPagePoint()

    return subpaths.map(([points, closed]) => {
        if (matrix) {
            for (let i = 0; i < points.length; i += 2) {
                let point: Point = {
                    x:
                        matrix.a * points[i] +
                        matrix.c * points[i + 1] +
                        matrix.e,
                    y:
                        matrix.b * points[i] +
                        matrix.d * points[i + 1] +
                        matrix.f,
                }
                if (transformPoint) point = transformPoint(point)
                points[i] = point.x - offsetX
                points[i + 1] = point.y - offsetY
            }
        }

        const n = points.length

        return createRing(
            points,
            !stroke ||
                closed ||
                Math.hypot(
                    points[0] - points[n - 2],
                    points[1] - points[n - 1]
                ) < 0.5
        )
    })
}

/**
 * Constrain dragging to the area within a path, or along its line.
 *
 * ```jsx
 * <motion.div drag dragConstraints={pathConstraints(pathRef)} />
 * ```
 *
 * The path can be an SVG geometry element (`<path>`, `<circle>`,
 * `<rect>`...) or a ref to one, which constrains the draggable's centre
 * to where the element is drawn. Or path data or a list of points, in
 * pixels relative to where the draggable sits when `x` and `y` are `0`.
 *
 * @public
 */
export function pathConstraints(
    target: PathTarget,
    { stroke = false, forgiveness = 20 }: PathConstraintsOptions = {}
): DragConstraintsFunction {
    return (controls) => {
        const { visualElement, elastic } = controls
        const origin = { ...controls.originPoint }
        const x = controls.getAxisMotionValue("x")
        const y = controls.getAxisMotionValue("y")
        const solve = createPathSolver(
            Array.isArray(target)
                ? [
                      createRing(
                          target.flatMap((p) => [p.x, p.y]),
                          !stroke
                      ),
                  ]
                : measureRings(target, visualElement, origin, stroke),
            origin,
            stroke,
            forgiveness
        )
        let current = origin

        const constraint: DragPointConstraint = {
            ...origin,

            /**
             * Move to the nearest point to the pointer, then out toward
             * it by the elastic of the edge it's beyond.
             */
            move() {
                current = solve({ x: constraint.x, y: constraint.y })
                const dx = constraint.x - current.x
                const dy = constraint.y - current.y
                x.set(current.x + dx * (dx < 0 ? elastic.x.min : elastic.x.max))
                y.set(current.y + dy * (dy < 0 ? elastic.y.min : elastic.y.max))
            },

            /**
             * Glide on with the release velocity, while springing back from
             * any elastic overshoot. The glide follows the inertia curve,
             * step by step: an edge in the way takes the step's push into
             * it, so the element slides along the edge with what's left.
             */
            release(
                velocity,
                {
                    power,
                    timeConstant,
                    restDelta,
                    bounceStiffness,
                    bounceDamping,
                }
            ) {
                const speed = Math.hypot(velocity.x, velocity.y)
                const overshootX = x.get() - current.x
                const overshootY = y.get() - current.y
                const overshootLength = Math.hypot(overshootX, overshootY)
                let overshoot = overshootLength > restDelta! ? 1 : 0
                let directionX = velocity.x / (speed || 1)
                let directionY = velocity.y / (speed || 1)
                let distance = 0
                let glide: JSAnimation<number> | undefined

                const render = () => {
                    x.set(current.x + overshootX * overshoot)
                    y.set(current.y + overshootY * overshoot)
                }

                return Promise.all([
                    x.start(
                        (onComplete) =>
                            (glide = new JSAnimation({
                                keyframes: [0, 0],
                                type: inertia,
                                velocity: speed,
                                power,
                                timeConstant,
                                restDelta,
                                onUpdate: (latest) => {
                                    const step = latest - distance
                                    distance = latest

                                    /**
                                     * Once stuck, completing jumps to the
                                     * glide's end. Ignore it.
                                     */
                                    if (!(step > 0) || !glide) return

                                    const prev = current
                                    // Gliding, nothing aims round corners
                                    current = solve(
                                        {
                                            x: prev.x + directionX * step,
                                            y: prev.y + directionY * step,
                                        },
                                        0
                                    )

                                    /**
                                     * Carry on at the speed the element
                                     * actually moved, never faster.
                                     */
                                    const dx = (current.x - prev.x) / step
                                    const dy = (current.y - prev.y) / step
                                    const retained = Math.hypot(dx, dy)
                                    directionX = dx / Math.max(1, retained)
                                    directionY = dy / Math.max(1, retained)

                                    if (retained < 0.01) {
                                        const stuck = glide
                                        glide = undefined
                                        stuck.complete()
                                    }

                                    render()
                                },
                                onComplete,
                            }))
                    ),
                    overshoot &&
                        y.start(
                            (onComplete) =>
                                new JSAnimation({
                                    keyframes: [1, 0],
                                    type: spring,
                                    stiffness: bounceStiffness,
                                    damping: bounceDamping,
                                    restDelta: restDelta! / overshootLength,
                                    onUpdate: (latest) => {
                                        overshoot = latest
                                        render()
                                    },
                                    onComplete,
                                })
                        ),
                ])
            },
        }

        return constraint
    }
}
