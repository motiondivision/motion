import { mixNumber } from "motion-dom"
import { moveItem, Box, Axis } from "motion-utils"
import { ItemData, Point } from "../types"

export function checkReorder<T>(
    order: ItemData<T>[],
    value: T,
    offset: Point,
    velocity: Point,
    axis: "x" | "y" | "xy"
): ItemData<T>[] {
    const currentIndex = order.findIndex((item) => item.value === value)
    if (currentIndex === -1) return order

    const currentItem = order[currentIndex]

    if (axis === "x" || axis === "y") {
        if (!velocity[axis]) return order

        const nextOffsetDirection = velocity[axis] > 0 ? 1 : -1
        const nextItemIndex = currentIndex + nextOffsetDirection

        if (nextItemIndex < 0 || nextItemIndex >= order.length) return order

        const nextItem = order[nextItemIndex]
        const itemLayout = currentItem.layout as Axis
        const nextLayout = nextItem.layout as Axis

        // TODO: Ensure itemLayout and nextLayout are indeed Axis and not Box.
        // This might happen if axis prop changes while dragging.
        // For now, proceeding with the assumption they are Axis.
        if (!itemLayout || !nextLayout || typeof itemLayout.min === "undefined" || typeof nextLayout.min === "undefined") {
             // Or handle error, or ensure types are always correct based on axis
            return order;
        }


        const nextItemCenter = mixNumber(nextLayout.min, nextLayout.max, 0.5)
        const currentItemBoundary = nextOffsetDirection === 1 ? itemLayout.max : itemLayout.min

        if (
            (nextOffsetDirection === 1 && currentItemBoundary + offset[axis] > nextItemCenter) ||
            (nextOffsetDirection === -1 && currentItemBoundary + offset[axis] < nextItemCenter)
        ) {
            return moveItem(order, currentIndex, nextItemIndex)
        }
    } else {
        // xy axis
        if (!velocity.x && !velocity.y) return order

        const currentItemLayout = currentItem.layout as Box
        // TODO: Ensure currentItemLayout is indeed Box.
        if (!currentItemLayout || !currentItemLayout.x || !currentItemLayout.y) {
            return order; // Or handle error
        }

        const currentItemCenter = {
            x: currentItemLayout.x.min + (currentItemLayout.x.max - currentItemLayout.x.min) / 2 + offset.x,
            y: currentItemLayout.y.min + (currentItemLayout.y.max - currentItemLayout.y.min) / 2 + offset.y,
        }

        let closestTargetIndex = -1;
        let minDistanceSq = Infinity;

        for (let i = 0; i < order.length; i++) {
            if (i === currentIndex) continue;

            const targetItem = order[i];
            const targetItemLayout = targetItem.layout as Box;
            if (!targetItemLayout.x || !targetItemLayout.y) continue;

            const targetCenter = {
                x: targetItemLayout.x.min + (targetItemLayout.x.max - targetItemLayout.x.min) / 2,
                y: targetItemLayout.y.min + (targetItemLayout.y.max - targetItemLayout.y.min) / 2,
            };

            const dx = currentItemCenter.x - targetCenter.x;
            const dy = currentItemCenter.y - targetCenter.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                closestTargetIndex = i;
            }
        }

        if (closestTargetIndex !== -1) {
            const closestTargetItem = order[closestTargetIndex];
            const closestTargetItemLayout = closestTargetItem.layout as Box;
            if (!closestTargetItemLayout.x || !closestTargetItemLayout.y) return order;


            // Check if the current item's center is within the bounding box of the closest target
            if (
                currentItemCenter.x > closestTargetItemLayout.x.min &&
                currentItemCenter.x < closestTargetItemLayout.x.max &&
                currentItemCenter.y > closestTargetItemLayout.y.min &&
                currentItemCenter.y < closestTargetItemLayout.y.max
            ) {
                return moveItem(order, currentIndex, closestTargetIndex);
            }
        }
    }

    return order
}
