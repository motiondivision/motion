"use client"

import { m } from "../../render/components/m/proxy"
import { createReorderGroup } from "./Group"

/**
 * A `Reorder.Group` that renders `m` components, so it gets its features
 * from `LazyMotion` instead of bundling them. Reordering needs `domMax`.
 */
export const Group = /*@__PURE__*/ createReorderGroup(m)
export { ReorderItem as Item } from "./Item"
export { ReorderBoard as Board } from "./Board"
