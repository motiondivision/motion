export function capturePointer(event: PointerEvent, action: "set" | "release") {
    const actionName = `${action}PointerCapture` as
        | "setPointerCapture"
        | "releasePointerCapture"

    if (
        event.target instanceof Element &&
        actionName in event.target &&
        event.pointerId !== undefined
    ) {
        try {
            event.target[actionName](event.pointerId)
        } catch (e) {}
    }
}
