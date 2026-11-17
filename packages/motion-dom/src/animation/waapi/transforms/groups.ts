import type { MotionValue } from "../../../value"

/**
 * The independent transform (x, scale, rotate etc) animations running on
 * each element, composed into one hardware-accelerated `transform`.
 *
 * Kept apart from the group itself so renderers and projection can tell a
 * group about outside changes without importing the animation code.
 */
export interface TransformGroupHooks {
    /**
     * A transform value may have been set by something other than one of
     * the group's animations.
     */
    check(): void

    /**
     * Hand every animation in the group back to the main thread, with
     * up-to-date values, e.g. before layout is measured. Returns true if
     * this wrote the element's transform. If it can return, it moves back
     * to the compositor when it next builds.
     */
    demote(canReturn?: boolean): true | void

    /**
     * Rebuild or retime the WAAPI animation.
     */
    schedule(needsBuild: boolean): void

    /**
     * A style animating on the main thread repaints the element this
     * frame. A hook so a renderer can count it without the frame loop.
     */
    repaint(value: MotionValue): void
}

export const transformGroups = new WeakMap<object, TransformGroupHooks>()

/**
 * An element repainted every frame by a style animating on the main thread
 * is rastered again every frame. With a compositor layer for its
 * transforms, each element is rastered on its own; without, they're
 * rastered together. Up to this many, the layers cost about the same and
 * keep transforms smooth while the main thread is busy. From here they
 * cost more, so the transforms of these elements move to the main thread
 * until they stop repainting.
 */
export const repaintLimit = 6

/**
 * TEST BUILD: the repaint rule is off. Transforms stay on the compositor
 * however many elements repaint.
 */
export const isRepainting = (_element: object) => false

export const markRepaint = (_element: object, _value?: MotionValue) => {}
