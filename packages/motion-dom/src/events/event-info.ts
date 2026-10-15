import { isPrimaryPointer } from "../gestures/utils/is-primary-pointer"
import type { EventInfo } from "../node/types"

export type EventListenerWithPointInfo = (
    e: PointerEvent,
    info: EventInfo
) => void

export function extractEventInfo(event: PointerEvent): EventInfo {
    return {
        point: {
            x: event.pageX,
            y: event.pageY,
        },
    }
}

export const addPointerInfo =
    (handler: EventListenerWithPointInfo): EventListener =>
    (event: PointerEvent) =>
        isPrimaryPointer(event) && handler(event, extractEventInfo(event))
