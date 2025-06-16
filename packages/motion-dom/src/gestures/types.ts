/**
 * Options for event listeners.
 *
 * @public
 */
export interface EventOptions {
    /**
     * Use passive event listeners. Doing so allows the browser to optimize
     * scrolling performance by not allowing the use of `preventDefault()`.
     *
     * @default true
     */
    passive?: boolean

    /**
     * Remove the event listener after the first event.
     *
     * @default false
     */
    once?: boolean
}
