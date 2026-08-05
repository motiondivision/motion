import { mixNumber } from "motion-dom"
import { moveItem, Point } from "motion-utils"
import { ItemData, ReorderAxis } from "../types"

export function checkReorder<T>(
    order: ItemData<T>[],
    value: T,
    offset: Point,
    velocity: Point,
    axis: ReorderAxis
): ItemData<T>[] {
    const index = order.findIndex((item) => item.value === value)

    if (index === -1) return order

    if (axis === "xy") {
        if (!velocity.x && !velocity.y) return order

        const { layout } = order[index]
        const center = {
            x: mixNumber(layout.x.min, layout.x.max, 0.5) + offset.x,
            y: mixNumber(layout.y.min, layout.y.max, 0.5) + offset.y,
        }
        const target = order.findIndex(
            (item, targetIndex) =>
                targetIndex !== index &&
                center.x >= item.layout.x.min &&
                center.x <= item.layout.x.max &&
                center.y >= item.layout.y.min &&
                center.y <= item.layout.y.max
        )

        return target === -1 ? order : moveItem(order, index, target)
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
