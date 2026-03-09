/**
 * @public
 */
export interface AnimateSuspenseProps {
    /**
     * Content that may suspend (e.g. lazy-loaded components, data fetching).
     */
    children: React.ReactNode

    /**
     * A `motion` component to display while children are suspended.
     * Use `exit` props on this element to animate it out when children resolve.
     *
     * ```jsx
     * <AnimateSuspense
     *   fallback={
     *     <motion.div exit={{ opacity: 0 }}>Loading...</motion.div>
     *   }
     * >
     *   <AsyncContent />
     * </AnimateSuspense>
     * ```
     */
    fallback: React.ReactNode

    /**
     * By passing `initial={false}`, the fallback will not animate in on first render.
     *
     * @public
     */
    initial?: boolean

    /**
     * @see AnimatePresenceProps.mode
     * @default "wait"
     *
     * @public
     */
    mode?: "sync" | "popLayout" | "wait"

    /**
     * Fires when the fallback has finished its exit animation.
     *
     * @public
     */
    onExitComplete?: () => void
}
