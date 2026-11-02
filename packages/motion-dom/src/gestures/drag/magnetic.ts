import type { Point } from "motion-utils"
import { animateMotionValue } from "../../animation/interfaces/motion-value"
import { JSAnimation } from "../../animation/JSAnimation"
import type { Transition } from "../../animation/types"
import { mixNumber } from "../../utils/mix/number"
import {
    resolveElements,
    type ElementOrSelector,
} from "../../utils/resolve-elements"
import type { DragConstraintsFunction, DragPointConstraint } from "./types"

/**
 * An element, a selector, or a React ref to an element.
 */
export type MagneticTarget = ElementOrSelector | { current: Element | null }

/**
 * @public
 */
export interface MagneticOptions {
    /**
     * The distance, in pixels from the centre of a target to the centre of
     * the dragged element, inside which the target attracts it. On
     * release, the element settles on the nearest target inside this
     * distance of where its momentum would carry it. Defaults to `100`.
     */
    radius?: number

    /**
     * How strongly, from `0` to `1`, a target pulls the element towards it
     * while dragging. The pull grows from nothing at `radius` to its full
     * strength at the target. `0` only attracts on release. Defaults to
     * `0.5`.
     */
    pull?: number

    /**
     * A distance, in pixels, inside which the element locks onto the
     * target while dragging, until the pointer moves out of it again.
     * Defaults to `0`.
     */
    snap?: number

    /**
     * The transition used to move onto and off a target, and to settle on
     * one on release. Defaults to a spring.
     */
    transition?: Transition

    /**
     * Called with the target that holds the element, or `null`, when that
     * changes. While dragging, a target holds the element inside `snap` if
     * `snap` is set, otherwise inside `radius`. On release, it's the
     * target the element settles on.
     */
    onChange?: (target: Element | null) => void
}

interface Magnet extends Point {
    element: Element
}

const toElements = (target: MagneticTarget): Element[] =>
    target && typeof target === "object" && "current" in target
        ? target.current
            ? [target.current]
            : []
        : resolveElements(target as ElementOrSelector)

const centre = ({ left, top, width, height }: DOMRect): Point => ({
    x: left + width / 2,
    y: top + height / 2,
})

/**
 * Make drag targets that attract the dragged element, for `dragConstraints`
 * or `drag()`'s `constraints`.
 *
 * ```jsx
 * <motion.div drag dragConstraints={magnetic([slotA, slotB])} />
 * ```
 *
 * ```javascript
 * drag("#card", { constraints: magnetic(".slot", { snap: 30 }) })
 * ```
 *
 * Targets are measured each time a drag starts.
 *
 * @public
 */
export function magnetic(
    targets: MagneticTarget | MagneticTarget[],
    {
        radius = 100,
        pull = 0.5,
        snap = 0,
        transition = { type: "spring", visualDuration: 0.3, bounce: 0.25 },
        onChange,
    }: MagneticOptions = {}
): DragConstraintsFunction {
    return (context) => {
        const { visualElement, originPoint } = context
        const element = visualElement.current!
        const { drag } = context.getProps()
        const axes = (["x", "y"] as const).filter(
            (axis) => drag === true || drag === axis
        )

        /**
         * Measure each target's centre relative to the element's, and
         * convert to the element's `x`/`y` values.
         */
        const from = centre(element.getBoundingClientRect())
        const magnets: Magnet[] = []
        ;([] as MagneticTarget[])
            .concat(targets)
            .flatMap(toElements)
            .forEach((target) => {
                if (target === element) return
                const to = centre(target.getBoundingClientRect())
                magnets.push({
                    element: target,
                    x: originPoint.x + to.x - from.x,
                    y: originPoint.y + to.y - from.y,
                })
            })

        const nearest = (p: Point, within: number) => {
            let found: Magnet | null = null
            let distance = within

            for (const magnet of magnets) {
                const d = Math.hypot(
                    axes.includes("x") ? magnet.x - p.x : 0,
                    axes.includes("y") ? magnet.y - p.y : 0
                )
                if (d <= distance) {
                    found = magnet
                    distance = d
                }
            }

            return [found, distance] as const
        }

        const values = {
            x: context.getAxisMotionValue("x"),
            y: context.getAxisMotionValue("y"),
        }
        const latest = (): Point => ({
            x: values.x.get() as number,
            y: values.y.get() as number,
        })

        let active: Magnet | null = null
        let snapped: Magnet | null = null
        let field: Magnet | null = null

        /**
         * Moving onto, off or between targets blends from where the
         * element was drawn, so it never jumps.
         */
        let blend: JSAnimation<number> | undefined
        let blendFrom: Point = latest()
        let progress = 1

        const setActive = (magnet: Magnet | null) => {
            if (magnet !== active) {
                active = magnet
                onChange?.(magnet ? magnet.element : null)
            }
        }

        const apply = () => {
            const [magnet, d] = nearest(point, radius)
            let to: Point = point

            if (magnet) {
                const k = d <= snap ? 1 : pull * (1 - d / radius) ** 2
                to = {
                    x: mixNumber(point.x, magnet.x, k),
                    y: mixNumber(point.y, magnet.y, k),
                }
            }

            for (const axis of axes) {
                values[axis].set(mixNumber(blendFrom[axis], to[axis], progress))
            }
        }

        const point: DragPointConstraint = {
            ...originPoint,
            move() {
                const [magnet, d] = nearest(point, radius)
                const nextSnapped = magnet && d <= snap ? magnet : null

                if (
                    nextSnapped !== snapped ||
                    (pull && magnet && field && magnet !== field)
                ) {
                    blend?.stop()
                    blendFrom = latest()
                    progress = 0
                    blend = new JSAnimation({
                        keyframes: [0, 1],
                        ...(transition as any),
                        onUpdate: (v: number) => {
                            progress = v
                            apply()
                        },
                    })
                }

                snapped = nextSnapped
                field = magnet
                setActive(snap ? snapped : magnet)
                apply()
            },
            release(velocity, inertia) {
                blend?.stop()

                /**
                 * Settle on the target nearest where momentum would carry
                 * the element, from where it's drawn.
                 */
                const at = latest()
                const power = inertia.power ?? 0.8
                const [magnet] = nearest(
                    {
                        x: at.x + velocity.x * power,
                        y: at.y + velocity.y * power,
                    },
                    radius
                )
                setActive(magnet)

                /**
                 * Off every target, an axis at rest has nowhere to go. An
                 * inertia animation from rest doesn't finish, so skip it.
                 */
                return Promise.all(
                    axes.map(
                        (axis) =>
                            (magnet || velocity[axis]) &&
                            values[axis].start(
                                animateMotionValue(
                                    axis,
                                    values[axis],
                                    magnet ? magnet[axis] : 0,
                                    {
                                        ...(magnet
                                            ? transition
                                            : { ...inertia, type: "inertia" }),
                                        velocity: velocity[axis],
                                    } as Transition,
                                    visualElement,
                                    false
                                )
                            )
                    )
                )
            },
        }

        return point
    }
}
