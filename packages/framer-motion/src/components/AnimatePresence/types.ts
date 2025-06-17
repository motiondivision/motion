/**
 * @public
 */
export interface AnimatePresenceProps {
    /**
     * By passing `initial={false}`, `AnimatePresence` will disable any initial animations on children
     * that are present when the component is first rendered.
     *
     * ```jsx
     * <AnimatePresence initial={false}>
     *   {isVisible && (
     *     <motion.div
     *       key="modal"
     *       initial={{ opacity: 0 }}
     *       animate={{ opacity: 1 }}
     *       exit={{ opacity: 0 }}
     *     />
     *   )}
     * </AnimatePresence>
     * ```
     *
     * @public
     */
    initial?: boolean

    /**
     * When a component is removed, there's no longer a chance to update its props. So if a component's `exit`
     * prop is defined as a dynamic variant and you want to pass a new `custom` prop, you can do so via `AnimatePresence`.
     * This will ensure all leaving components animate using the latest data.
     *
     * @public
     */
    custom?: any

    /**
     * Fires when all exiting nodes have completed animating out.
     *
     * @public
     */
    onExitComplete?: () => void

    /**
     * Determines how to handle entering and exiting elements.
     *
     * - `"sync"`: Default. Elements animate in and out as soon as they're added/removed.
     * - `"popLayout"`: Exiting elements are "popped" from the page layout, allowing sibling
     *      elements to immediately occupy their new layouts.
     * - `"wait"`: Only renders one component at a time. Wait for the exiting component to animate out
     *      before animating the next component in.
     *
     * @public
     */
    mode?: "sync" | "popLayout" | "wait"

    /**
     * Root element to use when injecting styles, used when mode === `"popLayout"`.
     * This defaults to document.head but can be overridden e.g. for use in shadow DOM.
     */
    root?: HTMLElement | ShadowRoot;

    /**
     * Internal. Used in Framer to flag that sibling children *shouldn't* re-render as a result of a
     * child being removed.
     */
    presenceAffectsLayout?: boolean

    /**
     * If true, the `AnimatePresence` component will propagate parent exit animations
     * to its children.
     */
    propagate?: boolean

    /**
     * Internal. Set whether to anchor the x position of the exiting element to the left or right
     * when using `mode="popLayout"`.
     */
    anchorX?: "left" | "right"
}
