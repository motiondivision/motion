"use client"

import {
    elementDragControls,
    microtask,
    visualElementStore,
    type VisualElementDragControls,
} from "motion-dom"
import type { Point } from "motion-utils"
import * as React from "react"
import { ReorderBoardContext } from "../../context/ReorderBoardContext"
import { useConstant } from "../../utils/use-constant"
import type {
    ReorderAxis,
    ReorderBoardProps,
    ReorderContextProps,
} from "./types"

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

function createBoard(): ReorderBoardProps {
    const groups = new Set<Group>()
    let handoff: Handoff | undefined

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
            const order = to.getOrder()
            const isRTL =
                getComputedStyle(to.groupRef.current!).direction === "rtl"
            const next = order.find(
                (item) =>
                    item.element &&
                    isBefore(point, item.element, to.axis, isRTL)
            )
            const last = order[order.length - 1]
            index = next
                ? values.indexOf(next.value)
                : last
                ? values.indexOf(last.value) + 1
                : values.length
        }

        const { scrollX, scrollY } = element.ownerDocument.defaultView!
        handoff = {
            value,
            to: to.groupRef,
            element,
            centre: { x: point.x + scrollX, y: point.y + scrollY },
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
             * Wait for the item to arrive in its new group before moving
             * it again. If the groups don't take it, it stays here until
             * this gesture ends.
             */
            if (handoff?.controls?.isDragging) return true

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

            if (!to || to.groupRef === from.groupRef) return false

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
                if (!target || group.groupRef === from.groupRef) continue

                const { left, right, top, bottom } =
                    target.getBoundingClientRect()
                const groupCentre =
                    axis === "x" ? (left + right) / 2 : (top + bottom) / 2

                if ((groupCentre - point[axis]) * direction <= 0) continue

                const x = Math.max(left - point.x, 0, point.x - right)
                const y = Math.max(top - point.y, 0, point.y - bottom)
                if (x * x + y * y < nearest) {
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

            const { keys, from, controls, event } = latest
            /**
             * Whether the groups moved the item, rather than copied it.
             */
            const isMoved = !latest.element.isConnected

            if (keys) {
                handoff = undefined
                if (isMoved) {
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

                const point = centre(element)
                const { scrollX, scrollY } = element.ownerDocument.defaultView!
                visualElement!
                    .getValue("x")!
                    .set(latest.centre.x - point.x - scrollX)
                visualElement!
                    .getValue("y")!
                    .set(latest.centre.y - point.y - scrollY)
                visualElement!.render()

                /**
                 * If the item is still in its previous group, animate it
                 * back to its slot there.
                 */
                isMoved ? controls.cancel() : controls.stop()
                nextControls.start(event as PointerEvent, { immediate: true })
            })

            /**
             * Its drag already started in its previous group.
             */
            return isMoved
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
 * Values must be unique across the groups. If the app keeps the groups'
 * values in one state, update it from the latest state (e.g.
 * `setColumns((columns) => ...)`), as both groups update it in turn.
 *
 * @public
 */
export function ReorderBoard({ children }: React.PropsWithChildren<{}>) {
    return (
        <ReorderBoardContext.Provider value={useConstant(createBoard)}>
            {children}
        </ReorderBoardContext.Provider>
    )
}
