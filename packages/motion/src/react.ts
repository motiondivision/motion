// Re-export everything from framer-motion.
//
// `motion` and `m` are aliased through local bindings so the module has
// explicit named exports for IDE auto-import (see #3432). The previous
// `export { motion, m } from "framer-motion"` line — sitting alongside
// `export * from "framer-motion"` — was a duplicate-source re-export pattern
// that caused Next.js Turbopack to OOM during module-graph analysis (#3741).
// Local declarations shadow the wildcard re-export per the ES spec, so
// `motion` and `m` come from the explicit bindings below and the rest from
// `export *`.
import * as fm from "framer-motion"

export const motion: typeof fm.motion = fm.motion
export const m: typeof fm.m = fm.m

export * from "framer-motion"
