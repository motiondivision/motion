export interface PressGestureInfo {
    success: boolean
}

export type OnPressEndEvent = (
    event: PointerEvent,
    info: PressGestureInfo
) => void

export type OnPressStartEvent = (
    element: Element,
    event: PointerEvent
) => OnPressEndEvent | void
