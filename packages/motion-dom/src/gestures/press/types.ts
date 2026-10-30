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

export interface PressOptions {
    /**
     * The number of quick, consecutive presses needed to start the press
     * gesture. For example, `2` for a double press.
     *
     * @default 1
     */
    times?: number

    /**
     * The maximum time, in seconds, between the end of one press and the
     * start of the next for both to count towards `times`.
     *
     * @default 0.3
     */
    timesInterval?: number

    /**
     * The time, in seconds, a press must be held before the press gesture
     * starts (long press). Releasing earlier starts nothing.
     *
     * @default 0
     */
    after?: number

    /**
     * While a started press is held, repeat it every `repeat` seconds.
     */
    repeat?: number

    /**
     * Called every frame while a press is held, with the progress (`0`-`1`)
     * towards `after`. Called with `1` when the press starts, or `0` if it
     * is released before.
     */
    onProgress?: (progress: number) => void
}
