import { ElementOrSelector } from "../utils/resolve-elements"
import { resizeElement } from "./handle-element"
import { resizeWindow } from "./handle-window"
import { ResizeHandler, WindowResizeHandler } from "./types"

export function resize(onResize: WindowResizeHandler): VoidFunction
export function resize(
    target: ElementOrSelector,
    onResize: ResizeHandler<Element>
): VoidFunction
export function resize(
    a: WindowResizeHandler | ElementOrSelector,
    b?: ResizeHandler<Element>
) {
    return typeof a === "function" ? resizeWindow(a) : resizeElement(a, b!)
}
