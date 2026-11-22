// Re-export everything from framer-motion.
//
// `m` is aliased through a local binding so the module has an explicit
// named export for IDE auto-import (see #3432). An
// `export { m } from "framer-motion"` line, next to
// `export * from "framer-motion"`, is a duplicate-source re-export pattern
// that caused Next.js Turbopack to OOM during module-graph analysis (#3741).
//
// `motion`, `Reorder` and `preloadFeatures` come from another entry, so
// they are plain re-exports. A local `const motion = ns.motion` here makes
// webpack keep the whole namespace, drag code included, for every import
// from this file. Named exports shadow the wildcard per the ES spec.
import * as fm from "framer-motion"

/**
 * `motion` components have animations and gestures from the start, and
 * fetch their layout and drag code the first time a component needs it.
 */
export { motion, preloadFeatures, Reorder } from "framer-motion/async"
export const m: typeof fm.m = fm.m

export * from "framer-motion"
