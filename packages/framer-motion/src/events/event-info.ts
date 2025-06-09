import { EventInfo, isPrimaryPointer } from "motion-dom"

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

export const addPointerInfo = (
    handler: EventListenerWithPointInfo
): EventListener => {
    return (event: PointerEvent) =>
        isPrimaryPointer(event) && handler(event, extractEventInfo(event))
}
