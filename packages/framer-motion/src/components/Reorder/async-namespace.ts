"use client"

import { motion } from "../../render/components/motion-async/proxy"
import { createReorderGroup } from "./Group"

/**
 * A `Reorder.Group` that renders motion components that fetch layout and
 * drag, so its items join the same projection tree as the components
 * around them.
 */
export const Group = /*@__PURE__*/ createReorderGroup(motion)
export { ReorderItem as Item } from "./Item"
export { ReorderBoard as Board } from "./Board"
