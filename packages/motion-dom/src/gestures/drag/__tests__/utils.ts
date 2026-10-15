import { frame } from "../../../frameloop"
import { visualElementStore } from "../../../render/store"

export interface Point {
    x: number
    y: number
}

/**
 * JSDOM doesn't support PointerEvent or layout, so fake pointer events
 * with a page point. The pan session reads `pageX`/`pageY`.
 */
export function pointer(
    target: EventTarget,
    type: string,
    pageX = 0,
    pageY = 0
) {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, { isPrimary: true, button: 0, pageX, pageY })
    target.dispatchEvent(event)
}

export const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

export const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

export interface Deferred<T> {
    promise: Promise<T>
    resolve: (value: T) => void
}

export function deferred<T = void>(): Deferred<T> {
    const def = {} as Deferred<T>
    def.promise = new Promise<T>((resolve) => {
        def.resolve = resolve
    })
    return def
}

/**
 * Mirrors the React suite's `drag(element, trigger).to(x, y).end()` helper:
 * press at the origin, move the pointer to each point (waiting a frame
 * each time) and release over the dragged element at the last point.
 */
export function gesture(element: Element, trigger: Element = element) {
    const last: Point = { x: 0, y: 0 }
    pointer(trigger, "pointerdown", 0, 0)

    const controls = {
        to: async (x: number, y: number) => {
            last.x = x
            last.y = y
            pointer(document.body, "pointermove", x, y)
            await nextFrame()
            return controls
        },
        end: (target: Element = element) => {
            pointer(target, "pointerup", last.x, last.y)
        },
    }

    return controls
}

/**
 * Read the `x`/`y` motion values drag() writes to.
 */
export function getValue(element: Element, key: string) {
    return visualElementStore.get(element)?.getValue(key)
}

export function values(element: Element) {
    return {
        x: (getValue(element, "x")?.get() as number) ?? 0,
        y: (getValue(element, "y")?.get() as number) ?? 0,
    }
}

export function createElement(
    tag = "div",
    parent: Element = document.body
): HTMLElement {
    const element = document.createElement(tag)
    parent.appendChild(element)
    return element
}
