export interface PressGestureInfo {
    success: boolean
}

export type OnPressEndEvent = (
    event: PointerEvent,
    info: PressGestureInfo
) => void

/**
 * Handlers for a single press gesture, returned from the press start
 * callback.
 */
export interface PressHandlers {
    /**
     * Called when the press gesture ends. `success` is `true` if it
     * completed: released on the element, after `times` presses and once
     * held for `after` seconds. Otherwise it's `false`.
     *
     * Returning this function directly from the press start callback is
     * equivalent.
     */
    onComplete?: OnPressEndEvent

    /**
     * Called every frame while the final press is held, with the progress
     * (`0`-`1`) towards `after`. Progress reaching `1` means the press can
     * now complete successfully.
     */
    onProgress?: (progress: number) => void

    /**
     * Called every `repeat` seconds while the press is held, with the
     * number of repeats so far.
     */
    onRepeat?: (count: number) => void
}

/**
 * Called when a press gesture starts, on the first pointer or key down.
 * Can return a function to call when the press ends, or an object of
 * `PressHandlers`.
 */
export type OnPressStartEvent = (
    element: Element,
    event: PointerEvent
) => OnPressEndEvent | PressHandlers | void

export interface PressOptions {
    /**
     * The number of quick, consecutive presses needed for the press
     * gesture to succeed. For example, `2` for a double press. The gesture
     * starts on the first press, and is cancelled if a press is too late
     * or too far away.
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
     * The time, in seconds, the final press must be held for the press
     * gesture to succeed (long press). Releasing earlier cancels it.
     *
     * @default 0
     */
    after?: number

    /**
     * While the final press is held, and once `after` is reached, repeat
     * it every `repeat` seconds. Each repeat calls the `onRepeat` handler
     * returned from the press start callback.
     */
    repeat?: number
}
