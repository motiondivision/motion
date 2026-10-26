"use client"

import {
    elementDragControls,
    microtask,
    visualElementStore,
    type VisualElementDragControls,
} from "motion-dom"
import type { Point } from "motion-utils"
import * as React from "react"
import { useRef } from "react"
import { ReorderBoardContext } from "../../context/ReorderBoardContext"
import { useConstant } from "../../utils/use-constant"
import { useIsomorphicLayoutEffect } from "../../utils/use-isomorphic-effect"
import type {
    ReorderAxis,
    ReorderBoardContextProps,
    ReorderContextProps,
} from "./types"

export interface Props<V> {
    /**
     * Whether `value` can move between two groups, from the group whose
     * values are `from` to the group whose values are `to`. It's called
     * before either group's `onReorder`. Return `false` to leave the item
     * where it is: a dragged item stays in its group until it's dragged
     * over another, and a keyboard move skips on to the next group that
     * way. Escape always returns a grabbed item to where it was grabbed.
     *
     * While a dragged item is over a group it refuses, it's called every
     * frame, so keep it fast and free of side effects.
     *
     * ```jsx
     * <Reorder.Board canMove={(card, from, to) => to.length < 5}>
     * ```
     *
     * @public
     */
    canMove?: (value: V, from: V[], to: V[]) => boolean
}

type Group = ReorderContextProps<any>
type DragEvent = MouseEvent | TouchEvent | PointerEvent

/**
 * An item moved to another group, to be picked up by its new component.
 */
interface Handoff {
    value: unknown
    to: Group["groupRef"]
    /**
     * The element it was moved from, and its centre in page coordinates.
     */
    element: Element
    centre: Point
    /**
     * When dragged: the gesture, and its latest event to continue it from.
     */
    controls?: VisualElementDragControls
    event?: DragEvent
    /**
     * When moved with the keyboard: the values to keep it grabbed with, if
     * it's still grabbed.
     */
    keys?: boolean
    from?: unknown[]
}

const centre = (element: Element): Point => {
    const { left, top, width, height } = element.getBoundingClientRect()
    return { x: left + width / 2, y: top + height / 2 }
}

/**
 * Its centre in page coordinates.
 */
const pageCentre = (element: Element): Point => {
    const { x, y } = centre(element)
    const { scrollX, scrollY } = element.ownerDocument.defaultView!
    return { x: x + scrollX, y: y + scrollY }
}

/**
 * Whether `point` comes before `element` in its group's order: before its
 * centre on `axis` or, on "xy", above its line or before its centre on it.
 */
function isBefore(
    point: Point,
    element: Element,
    axis: ReorderAxis,
    isRTL: boolean
) {
    const { left, right, top, bottom } = element.getBoundingClientRect()
    const x = isRTL
        ? point.x > (left + right) / 2
        : point.x <= (left + right) / 2
    const y = point.y <= (top + bottom) / 2

    return axis === "x"
        ? x
        : axis === "y"
        ? y
        : point.y < top || (point.y < bottom && x)
}

/**
 * Whether one group is, or holds, the other: like a list of columns and the
 * list of cards in one of them. Items only move between unrelated groups.
 */
const isNested = (a: Group, b: Group) => {
    const x = a.groupRef.current!
    const y = b.groupRef.current!
    return x.contains(y) || y.contains(x)
}

function createBoard(props: {
    current: Props<unknown>
}): ReorderBoardContextProps {
    const groups = new Set<Group>()
    let handoff: Handoff | undefined

    /**
     * Whether `value` can move between these groups, if the app lets it.
     */
    const canMove = (from: Group, to: Group, value: unknown) =>
        !isNested(from, to) &&
        props.current.canMove?.(value, from.values, to.values) !== false

    /**
     * Where the latest keyboard grab began, for Escape to return it there.
     */
    let origin: { group: Group["groupRef"]; from: unknown[] } | undefined

    /**
     * Move `value` from one group to another: to `index` in its values or,
     * by default, the slot under the item's centre.
     */
    const move = (
        from: Group,
        to: Group,
        value: unknown,
        element: Element,
        props: Partial<Handoff>,
        index?: number
    ) => {
        const point = centre(element)
        const { values } = to

        if (index === undefined) {
            /**
             * Only the items it shows: a group keeps unmounted (e.g.
             * virtualized) items' data while their values remain.
             */
            const order = to
                .getOrder()
                .filter((item) => item.ref?.current?.isConnected)
            const isRTL =
                getComputedStyle(to.groupRef.current!).direction === "rtl"
            const next = order.find((item) =>
                isBefore(point, item.ref!.current!, to.axis, isRTL)
            )
            const last = order[order.length - 1]
            index = next
                ? values.indexOf(next.value)
                : last
                ? values.indexOf(last.value) + 1
                : values.length
        }

        handoff = {
            value,
            to: to.groupRef,
            element,
            centre: pageCentre(element),
            ...props,
        }

        /**
         * The release that ends a drag lands over the new group.
         */
        to.hasReordered.current = true

        from.onReorder(
            from.values.filter((item) => item !== value),
            value
        )
        to.onReorder(
            [...values.slice(0, index), value, ...values.slice(index)],
            value
        )
    }

    return {
        add: (group) => {
            groups.add(group)
            return () => groups.delete(group)
        },

        drag: (from, value, element, event) => {
            /**
             * The item can unmount mid-drag (e.g. the app removed it), while
             * its gesture carries on until release.
             */
            if (!element?.isConnected) return false

            /**
             * Wait for the item to arrive in its new group before moving
             * it again, keeping up with where it's dragged meanwhile, for
             * its drag to carry on from there. If the groups don't take
             * it, it stays here until this gesture ends.
             */
            if (handoff?.controls?.isDragging) {
                if (handoff.value === value) {
                    handoff.centre = pageCentre(element)
                    handoff.event = event
                }
                return true
            }

            const point = centre(element)
            let to: Group | undefined

            for (const hit of element.ownerDocument.elementsFromPoint(
                point.x,
                point.y
            )) {
                // Skip the item, which is drawn above everything else
                if (element.contains(hit)) continue

                for (const group of groups) {
                    if (group.groupRef.current === hit) to = group
                }

                if (to) break
            }

            if (!to || !canMove(from, to, value)) return false

            const visualElement = visualElementStore.get(element)
            move(from, to, value, element, {
                controls:
                    visualElement && elementDragControls.get(visualElement),
                event,
            })

            return true
        },

        key: (from, value, keyIndex, element, grabbed) => {
            const point = centre(element)
            const axis = keyIndex % 2 ? "x" : "y"
            const direction = keyIndex > 1 ? 1 : -1
            let to: Group | undefined
            let nearest = Infinity

            for (const group of groups) {
                const target = group.groupRef.current
                if (!target) continue

                const { left, right, top, bottom, width, height } =
                    target.getBoundingClientRect()

                // Hidden, e.g. display: none
                if (!width && !height) continue

                /**
                 * Its near edge is past the item that way, so a group beside
                 * this one isn't below its last item, whatever their heights.
                 */
                const edge = [bottom, right, top, left][keyIndex]
                if ((edge - point[axis]) * direction <= 0) continue

                const x = Math.max(left - point.x, 0, point.x - right)
                const y = Math.max(top - point.y, 0, point.y - bottom)
                if (x * x + y * y < nearest && canMove(from, group, value)) {
                    nearest = x * x + y * y
                    to = group
                }
            }

            if (!to) return false

            if (origin?.from !== grabbed) {
                origin = { group: from.groupRef, from: grabbed }
            }
            move(from, to, value, element, { keys: true, from: grabbed })

            return true
        },

        restore: (from, value, element, grabbed) => {
            const to =
                origin?.from === grabbed &&
                [...groups].find((group) => group.groupRef === origin!.group)

            if (!to || to.groupRef === from.groupRef) return false

            /**
             * Before the first value that followed it when it was grabbed,
             * and is still there.
             */
            const after = grabbed.slice(grabbed.indexOf(value) + 1)
            const index = to.values.findIndex((item) => after.includes(item))

            origin = undefined
            move(
                from,
                to,
                value,
                element,
                { keys: true },
                index < 0 ? to.values.length : index
            )

            return true
        },

        end: (value) => {
            if (handoff?.value === value) handoff = undefined
        },

        isMoving: (element) => handoff?.element === element,

        receive: (to, value, element, grab) => {
            const visualElement = visualElementStore.get(element)
            const nextControls =
                visualElement && elementDragControls.get(visualElement)

            /**
             * React 19's Strict Mode remounts a new item, which resets its
             * whileDrag, after its drag may already have carried on.
             */
            nextControls?.isDragging &&
                visualElement!.animationState?.setActive("whileDrag", true)

            const latest = handoff
            if (
                !latest ||
                latest.value !== value ||
                latest.to !== to.groupRef
            ) {
                return false
            }

            const { keys, from, controls } = latest
            /**
             * Whether the groups moved the item, rather than copied it.
             */
            const isMoved = !latest.element.isConnected

            if (keys) {
                handoff = undefined
                /**
                 * Unless focus has moved on since, e.g. the groups took it
                 * much later.
                 */
                const { activeElement, body } = element.ownerDocument
                if (isMoved && (!activeElement || activeElement === body)) {
                    ;(element as HTMLElement).focus()
                    grab(element, from)
                }
                return false
            }

            if (!nextControls || !controls?.isDragging) return false

            /**
             * Once the commit that moved the item has been measured, and
             * before it's drawn. Until then, the item's drag in its
             * previous group waits.
             */
            microtask.read(() => {
                if (handoff !== latest) return
                handoff = undefined

                /**
                 * Start it where, and as, the item was dragged to (e.g.
                 * mid-way through its whileDrag animation), and carry on
                 * dragging it from there. Values are read from the item
                 * first, for its whileDrag to return to on release.
                 */
                visualElementStore
                    .get(latest.element)
                    ?.values.forEach((motionValue, key) => {
                        const current = motionValue.get()
                        visualElement!
                            .getValue(
                                key,
                                visualElement!.readValue(key, current)
                            )
                            ?.set(current)
                    })

                /**
                 * Into the item's own coordinates, e.g. in a scaled parent.
                 */
                const transform =
                    visualElement!.getTransformPagePoint() ||
                    ((p: Point) => p)
                const a = transform(latest.centre)
                const b = transform(pageCentre(element))
                visualElement!.getValue("x")!.set(a.x - b.x)
                visualElement!.getValue("y")!.set(a.y - b.y)
                visualElement!.render()

                /**
                 * If the item is still in its previous group, animate it
                 * back to its slot there.
                 */
                isMoved ? controls.cancel() : controls.stop()
                nextControls.start(latest.event as PointerEvent, {
                    immediate: true,
                })
            })

            /**
             * Its drag already started in its previous group.
             */
            return isMoved
        },

        column: ({ groupRef }) => {
            let element = groupRef.current
            const holdsOther = (ancestor: Element) =>
                [...groups].some(
                    (group) =>
                        group.groupRef !== groupRef &&
                        ancestor.contains(group.groupRef.current)
                )

            while (
                element?.parentElement?.parentElement &&
                !holdsOther(element.parentElement)
            ) {
                element = element.parentElement
            }

            return element
        },
    }
}

/**
 * Lets items be dragged between the `Reorder.Group`s inside it.
 *
 * ```jsx
 * <Reorder.Board>
 *   <Reorder.Group values={todo} onReorder={setTodo}>
 *     {todo.map((item) => <Reorder.Item key={item} value={item} />)}
 *   </Reorder.Group>
 *   <Reorder.Group values={done} onReorder={setDone}>
 *     {done.map((item) => <Reorder.Item key={item} value={item} />)}
 *   </Reorder.Group>
 * </Reorder.Board>
 * ```
 *
 * When an item's centre is dragged over another group, it moves there:
 * the group it left calls `onReorder` without it, and the group it joined
 * calls `onReorder` with it, both passing it as the moved value. Their
 * other items animate to make room, and the drag carries on in the new
 * group.
 *
 * Grabbed with the keyboard, an item moves to the nearest group in the
 * direction of an arrow key across its group's axis, or along it from
 * either end. Escape returns it to the group and slot it was grabbed from.
 *
 * `canMove` can refuse a move before either group updates.
 *
 * Values must be unique across the groups. If the app keeps the groups'
 * values in one state, update it from the latest state (e.g.
 * `setColumns((columns) => ...)`), as both groups update it in turn.
 *
 * @public
 */
export function ReorderBoard<V = any>({
    children,
    ...props
}: React.PropsWithChildren<Props<V>>) {
    const latest = useRef(props as Props<unknown>)

    /**
     * In a layout effect, so a render React discards can't leave its
     * props here.
     */
    useIsomorphicLayoutEffect(() => {
        latest.current = props as Props<unknown>
    })

    return (
        <ReorderBoardContext.Provider
            value={useConstant(() => createBoard(latest))}
        >
            {children}
        </ReorderBoardContext.Provider>
    )
}
