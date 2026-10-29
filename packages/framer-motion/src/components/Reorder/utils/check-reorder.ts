import { mixNumber } from "motion-dom"
import { Axis, moveItem, Point } from "motion-utils"
import { ItemData, ReorderAxis } from "../types"

export function checkReorder<T>(
    order: ItemData<T>[],
    value: T,
    offset: Point,
    velocity: Point,
    axis: ReorderAxis,
    direction: "ltr" | "rtl" = "ltr"
): ItemData<T>[] {
    const index = order.findIndex((item) => item.value === value)

    if (index === -1) return order

    if (axis === "xy") {
        const { layout } = order[index]
        const point = {
            x: center(layout.x) + offset.x,
            y: center(layout.y) + offset.y,
        }
        const lines = getLines(order)
        const sourceLine = lines.find((line) =>
            line.items.includes(order[index])
        )!
        const targetLine = lines.reduce((closest, line) =>
            distanceToLine(point.y, line) < distanceToLine(point.y, closest)
                ? line
                : closest
        )

        if (targetLine !== sourceLine) {
            return moveToLine(order, index, point.x, targetLine, direction)
        }

        const currentDistance = distanceToBox(point, layout)
        let target = -1
        let targetDistance = currentDistance

        order.forEach((item, targetIndex) => {
            if (targetIndex === index) return
            const distance = distanceToBox(point, item.layout)
            if (distance < targetDistance) {
                target = targetIndex
                targetDistance = distance
            }
        })

        return target === -1
            ? order
            : moveItem(order, index, index + Math.sign(target - index))
    }

    if (!velocity[axis]) return order

    const nextOffset = velocity[axis] > 0 ? 1 : -1
    const nextItem = order[index + nextOffset]

    if (!nextItem) return order

    const item = order[index]
    const itemLayout = item.layout[axis]
    const nextLayout = nextItem.layout[axis]
    const nextItemCenter = center(nextLayout)

    if (
        (nextOffset === 1 && itemLayout.max + offset[axis] > nextItemCenter) ||
        (nextOffset === -1 && itemLayout.min + offset[axis] < nextItemCenter)
    ) {
        return moveItem(order, index, index + nextOffset)
    }

    return order
}

/**
 * Moves `value` one place for an arrow key, `key` being its index in
 * Up, Left, Down, Right. Left and Right move along the order (swapped in
 * RTL). On the "xy" axis, Up and Down move to the row above or below, into
 * the slot of the item there nearest across.
 */
export function keyReorder<T>(
    order: ItemData<T>[],
    value: T,
    key: number,
    axis: ReorderAxis,
    isRTL: boolean
): ItemData<T>[] {
    const index = order.findIndex((item) => item.value === value)
    const step = key > 1 !== !!(key % 2 && isRTL) ? 1 : -1
    let target = index + step

    if (axis === "xy" && !(key % 2) && index > -1) {
        const lines = getLines(order)
        const line =
            lines[
                lines.findIndex(({ items }) => items.includes(order[index])) +
                    step
            ]
        const distance = (item: ItemData<T>) =>
            Math.abs(center(item.layout.x) - center(order[index].layout.x))

        target = line
            ? order.indexOf(
                  line.items.reduce((nearest, item) =>
                      distance(item) < distance(nearest) ? item : nearest
                  )
              )
            : -1
    }

    return index > -1 && order[target] ? moveItem(order, index, target) : order
}

const center = ({ min, max }: Axis) => mixNumber(min, max, 0.5)

interface Line<T> {
    items: ItemData<T>[]
    min: number
    max: number
}

function getLines<T>(order: ItemData<T>[]) {
    const lines: Line<T>[] = []

    order.forEach((item) => {
        const { min, max } = item.layout.y
        const line = lines[lines.length - 1]

        if (!line || min >= line.max || max <= line.min) {
            lines.push({ items: [item], min, max })
        } else {
            line.items.push(item)
            line.min = Math.min(line.min, min)
            line.max = Math.max(line.max, max)
        }
    })

    return lines
}

function distanceToLine<T>(y: number, line: Line<T>) {
    return y < line.min ? line.min - y : y > line.max ? y - line.max : 0
}

function moveToLine<T>(
    order: ItemData<T>[],
    index: number,
    x: number,
    line: Line<T>,
    direction: "ltr" | "rtl"
) {
    const remaining = order.filter((_, itemIndex) => itemIndex !== index)
    const before = line.items.find((item) => {
        const itemCenter = center(item.layout.x)
        return direction === "ltr" ? x < itemCenter : x > itemCenter
    })
    const targetIndex = before
        ? remaining.indexOf(before)
        : remaining.indexOf(line.items[line.items.length - 1]) + 1
    const nextOrder = [...remaining]
    nextOrder.splice(targetIndex, 0, order[index])

    return nextOrder.every((item, itemIndex) => item === order[itemIndex])
        ? order
        : nextOrder
}

function distanceToBox(point: Point, box: ItemData<unknown>["layout"]) {
    const x = Math.max(box.x.min - point.x, 0, point.x - box.x.max)
    const y = Math.max(box.y.min - point.y, 0, point.y - box.y.max)
    return x * x + y * y
}
