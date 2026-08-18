import { mixNumber } from "motion-dom"
import { moveItem, Point } from "motion-utils"
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
        const center = {
            x: mixNumber(layout.x.min, layout.x.max, 0.5) + offset.x,
            y: mixNumber(layout.y.min, layout.y.max, 0.5) + offset.y,
        }
        const lines = getLines(order)
        const sourceLine = lines.find((line) =>
            line.items.includes(order[index])
        )!
        const targetLine = lines.reduce((closest, line) =>
            distanceToLine(center.y, line) < distanceToLine(center.y, closest)
                ? line
                : closest
        )

        if (targetLine !== sourceLine) {
            return moveToLine(order, index, center.x, targetLine, direction)
        }

        const currentDistance = distanceToBox(center, layout)
        let target = -1
        let targetDistance = currentDistance

        order.forEach((item, targetIndex) => {
            if (targetIndex === index) return
            const distance = distanceToBox(center, item.layout)
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
    const nextItemCenter = mixNumber(nextLayout.min, nextLayout.max, 0.5)

    if (
        (nextOffset === 1 && itemLayout.max + offset[axis] > nextItemCenter) ||
        (nextOffset === -1 && itemLayout.min + offset[axis] < nextItemCenter)
    ) {
        return moveItem(order, index, index + nextOffset)
    }

    return order
}

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
        const center = mixNumber(item.layout.x.min, item.layout.x.max, 0.5)
        return direction === "ltr" ? x < center : x > center
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
