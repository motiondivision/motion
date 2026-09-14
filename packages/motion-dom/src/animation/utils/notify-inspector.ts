import { frameData } from "../../frameloop/frame"
import { time } from "../../frameloop/sync-time"

interface MotionInspectBase {
    animation: unknown
    timestamp: number
    frameTimestamp: number
    frameIsProcessing: boolean
}

interface MotionInspectAnimationStart extends MotionInspectBase {
    kind: "animation-start"
    options: object
}

interface MotionInspectLayoutAnimationStart extends MotionInspectBase {
    kind: "layout-animation-start"
    node: unknown
}

type MotionInspectRecord =
    | MotionInspectAnimationStart
    | MotionInspectLayoutAnimationStart

type MotionInspectHook = (record: MotionInspectRecord) => void

type InspectGlobal = typeof globalThis & {
    __MOTION_INSPECT__?: MotionInspectHook
}

function baseRecord<K extends MotionInspectRecord["kind"]>(
    kind: K,
    animation: unknown
) {
    return {
        kind,
        animation,
        timestamp: time.now(),
        frameTimestamp: frameData.timestamp,
        frameIsProcessing: frameData.isProcessing,
    }
}

/**
 * Notify an optional inspector without adding a public Motion API.
 *
 * The record is a raw firehose: the live animation handle, the concrete
 * animation's internal options object untouched (timing fields in
 * internal milliseconds, name/keyframes/element/motionValue still
 * attached), a timestamp and the raw frameloop state at notify time.
 * All interpretation belongs to the consumer behind
 * globalThis.__MOTION_INSPECT__.
 */
export function notifyAnimationStart(
    animation: unknown,
    options: object,
    transition?: object
): void {
    const notify = (globalThis as InspectGlobal).__MOTION_INSPECT__
    if (!notify) return

    try {
        notify({
            ...baseRecord("animation-start", animation),
            options: transition ? { ...options, ...transition } : options,
        })
    } catch {}
}

/**
 * Layout animations drive a projection node's progress rather than a
 * property, so the record forwards the live node itself: it carries the
 * DOM instance, the layout options (layoutId) and the progress handle.
 * Fired inside the frame.update that starts the animation, so nodes
 * animating in the same layout commit share frameTimestamp.
 */
export function notifyLayoutAnimationStart(
    animation: unknown,
    node: unknown
): void {
    const notify = (globalThis as InspectGlobal).__MOTION_INSPECT__
    if (!notify) return

    try {
        notify({
            ...baseRecord("layout-animation-start", animation),
            node,
        })
    } catch {}
}
