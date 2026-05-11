import type { ReactNode } from "react"

/**
 * @public
 */
export interface AnimateSuspenseProps {
    /**
     * Content that may suspend, e.g. a `React.lazy()` component or a child
     * that reads data from a suspending source.
     */
    children: ReactNode

    /**
     * Element displayed while `children` is suspended. To animate the
     * fallback out when children resolve, use a `motion` component with an
     * `exit` prop.
     *
     * ```jsx
     * <AnimateSuspense
     *   fallback={
     *     <motion.div
     *       initial={{ opacity: 0 }}
     *       animate={{ opacity: 1 }}
     *       exit={{ opacity: 0 }}
     *     >
     *       Loading...
     *     </motion.div>
     *   }
     * >
     *   <LazyContent />
     * </AnimateSuspense>
     * ```
     */
    fallback: ReactNode

    /**
     * By passing `initial={false}`, the fallback will not animate in when it
     * first appears.
     *
     * @public
     */
    initial?: boolean

    /**
     * Determines how the fallback enters and exits relative to the children.
     *
     * - `"sync"`: Default. The fallback animates out at the same time as
     *      `children` are revealed.
     * - `"wait"`: The fallback finishes its exit animation before children
     *      are revealed.
     * - `"popLayout"`: The fallback is "popped" from the page layout while
     *      exiting, allowing siblings to immediately occupy its space.
     *
     * @public
     */
    mode?: "sync" | "popLayout" | "wait"

    /**
     * Fires once the fallback has completed its exit animation.
     *
     * @public
     */
    onExitComplete?: () => void

    /**
     * Forwarded to `AnimatePresence`. Use this to drive dynamic exit variants
     * on the fallback.
     *
     * @public
     */
    custom?: unknown
}
