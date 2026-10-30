export interface PressGestureInfo {
    success: boolean
}

export type OnPressEndEvent = (
    event: PointerEvent,
    info: PressGestureInfo
) => void

/**
 * Handlers for a single press, returned from the press start callback.
 */
export interface PressHandlers {
    /**
     * Called when the press ends, with `success: false` if it was
     * cancelled. Returning this function directly from the press start
     * callback is equivalent.
     */
    onComplete?: OnPressEndEvent

    /**
     * Called every `repeat` seconds while the press is held, with the
     * number of repeats so far.
     */
    onRepeat?: (count: number) => void
}

/**
 * Called when a press starts. Can return a function to call when the
 * press ends, or an object of `PressHandlers`.
 */
export type OnPressStartEvent = (
    element: Element,
    event: PointerEvent
) => OnPressEndEvent | PressHandlers | void

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
     * Each repeat calls the `onRepeat` handler returned from the press
     * start callback.
     */
    repeat?: number

    /**
     * Called every frame while a press is held, with the progress (`0`-`1`)
     * towards `after`. Called with `1` when the press starts, or `0` if it
     * is released before.
     *
     * This is an option, not a handler returned from the press start
     * callback, because with `after` the press only starts once progress
     * reaches `1`.
     */
    onProgress?: (progress: number) => void
}
