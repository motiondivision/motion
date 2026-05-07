export * from "framer-motion/dom"

/**
 * Re-export the framework-agnostic node options under the `MotionProps`
 * name for users building wrappers in non-React frameworks (Svelte, Vue,
 * etc.) who want the props type without pulling in `motion/react`.
 */
export type { MotionNodeOptions as MotionProps } from "framer-motion/dom"
