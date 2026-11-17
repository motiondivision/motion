import { frame } from "../../../frameloop"
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
 * Elements that repainted in the last frame, and so far in this one, each
 * with the value that repainted it, if that's known.
 */
type Repaints = Map<object, MotionValue | undefined>
let repainted: Repaints = new Map()
let repainting: Repaints = new Map()

const isOver = (elements: Repaints, element: object) =>
    elements.size >= repaintLimit && elements.has(element)

/**
 * Whether an element's transforms should stay on the main thread because
 * it's one of too many repainting elements.
 */
export const isRepainting = (element: object) =>
    isOver(repainting, element) || isOver(repainted, element)

const nextFrame = () => {
    const previous = repainted
    repainted = repainting
    repainting = new Map()

    /**
     * A value that's still animating repaints its element again, if not
     * on this frame: a colour near its target is a new value only every
     * few frames. So its element still counts, rather than its transforms
     * moving to the compositor and back between changes.
     */
    repainted.forEach(
        (value, element) =>
            value?.animation?.state === "running" &&
            repainting.set(element, value)
    )

    /**
     * Elements held on the main thread that no longer repaint, or are no
     * longer too many, move back to the compositor.
     */
    previous.size >= repaintLimit &&
        previous.forEach(
            (_, element) =>
                isRepainting(element) ||
                transformGroups.get(element)?.schedule(true)
        )

    repainted.size && frame.postRender(nextFrame)
}

/**
 * Note that an element repaints this frame, for a value if it's given.
 */
export const markRepaint = (element: object, value?: MotionValue) => {
    if (repainting.has(element)) {
        value && repainting.set(element, value)
        return
    }

    repainting.size || frame.postRender(nextFrame)
    repainting.set(element, value)

    const { size } = repainting
    if (size === repaintLimit) {
        repainting.forEach((_, e) => transformGroups.get(e)?.demote(true))
    } else if (size > repaintLimit) {
        transformGroups.get(element)?.demote(true)
    }
}
