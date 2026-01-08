import type { EventInfo, PanHandler } from "motion-dom"
import { cancelFrame, frame, frameData, isPrimaryPointer } from "motion-dom"
import {
    millisecondsToSeconds,
    pipe,
    Point,
    secondsToMilliseconds,
    TransformPoint,
} from "motion-utils"
import { addPointerEvent } from "../../events/add-pointer-event"
import { extractEventInfo } from "../../events/event-info"
import { distance2D } from "../../utils/distance"

interface PanSessionHandlers {
    onSessionStart: PanHandler
    onStart: PanHandler
    onMove: PanHandler
    onEnd: PanHandler
    onSessionEnd: PanHandler
    resumeAnimation: () => void
}

interface PanSessionOptions {
    transformPagePoint?: TransformPoint
    dragSnapToOrigin?: boolean
    distanceThreshold?: number
    contextWindow?: (Window & typeof globalThis) | null
    /**
     * Element to track scroll for during the pan session.
     * When provided, scroll events on ancestors and window are compensated
     * so the gesture continues smoothly during scroll.
     */
    scrollableElement?: HTMLElement | null
}

interface TimestampedPoint extends Point {
    timestamp: number
}

/**
 * @internal
 */
export class PanSession {
    /**
     * @internal
     */
    private history: TimestampedPoint[]

    /**
     * @internal
     */
    private startEvent: PointerEvent | null = null

    /**
     * @internal
     */
    private lastMoveEvent: PointerEvent | null = null

    /**
     * @internal
     */
    private lastMoveEventInfo: EventInfo | null = null

    /**
     * @internal
     */
    private transformPagePoint?: TransformPoint

    /**
     * @internal
     */
    private handlers: Partial<PanSessionHandlers> = {}

    /**
     * @internal
     */
    private removeListeners: Function

    /**
     * For determining if an animation should resume after it is interupted
     *
     * @internal
     */
    private dragSnapToOrigin: boolean

    /**
     * The distance after which panning should start.
     *
     * @internal
     */
    private distanceThreshold: number

    /**
     * @internal
     */
    private contextWindow: PanSessionOptions["contextWindow"] = window

    /**
     * Scroll positions of ancestor elements when scroll tracking started.
     * @internal
     */
    private ancestorScrolls: Map<Element, Point> = new Map()

    /**
     * Window scroll position when scroll tracking started.
     * @internal
     */
    private windowScroll: Point = { x: 0, y: 0 }

    /**
     * Cleanup function for scroll listeners.
     * @internal
     */
    private removeScrollListeners: (() => void) | null = null

    constructor(
        event: PointerEvent,
        handlers: Partial<PanSessionHandlers>,
        {
            transformPagePoint,
            contextWindow = window,
            dragSnapToOrigin = false,
            distanceThreshold = 3,
            scrollableElement,
        }: PanSessionOptions = {}
    ) {
        // If we have more than one touch, don't start detecting this gesture
        if (!isPrimaryPointer(event)) return

        this.dragSnapToOrigin = dragSnapToOrigin
        this.handlers = handlers
        this.transformPagePoint = transformPagePoint
        this.distanceThreshold = distanceThreshold
        this.contextWindow = contextWindow || window

        const info = extractEventInfo(event)
        const initialInfo = transformPoint(info, this.transformPagePoint)
        const { point } = initialInfo

        const { timestamp } = frameData

        this.history = [{ ...point, timestamp }]

        const { onSessionStart } = handlers
        onSessionStart &&
            onSessionStart(event, getPanInfo(initialInfo, this.history))

        this.removeListeners = pipe(
            addPointerEvent(
                this.contextWindow,
                "pointermove",
                this.handlePointerMove
            ),
            addPointerEvent(
                this.contextWindow,
                "pointerup",
                this.handlePointerUp
            ),
            addPointerEvent(
                this.contextWindow,
                "pointercancel",
                this.handlePointerUp
            )
        )

        // Start scroll tracking if element provided
        if (scrollableElement) {
            this.startScrollTracking(scrollableElement)
        }
    }

    /**
     * Start tracking scroll on ancestors and window.
     */
    private startScrollTracking(element: HTMLElement): void {
        // Store initial scroll positions for all ancestors
        let current = element.parentElement
        while (current) {
            this.ancestorScrolls.set(current, {
                x: current.scrollLeft,
                y: current.scrollTop,
            })
            current = current.parentElement
        }

        // Track window scroll
        this.windowScroll = { x: window.scrollX, y: window.scrollY }

        // Capture listener catches element scroll events as they bubble
        window.addEventListener("scroll", this.handleElementScroll, {
            capture: true,
            passive: true,
        })

        // Direct window scroll listener (window scroll doesn't bubble)
        window.addEventListener("scroll", this.handleWindowScroll, {
            passive: true,
        })

        this.removeScrollListeners = () => {
            window.removeEventListener("scroll", this.handleElementScroll, {
                capture: true,
            })
            window.removeEventListener("scroll", this.handleWindowScroll)
        }
    }

    /**
     * Handle scroll on ancestor elements.
     * Adjusts the history origin to compensate for scroll, making it appear
     * as if the pointer moved in the opposite direction.
     */
    private handleElementScroll = (event: Event): void => {
        const target = event.target as Element
        const initial = this.ancestorScrolls.get(target)
        if (!initial) return

        const current = { x: target.scrollLeft, y: target.scrollTop }
        const delta = { x: current.x - initial.x, y: current.y - initial.y }

        if (delta.x === 0 && delta.y === 0) return

        // Adjust the origin point in history.
        // offset = currentPoint - history[0]
        // To increase offset by delta, decrease history[0] by delta.
        if (this.history.length > 0) {
            this.history[0].x -= delta.x
            this.history[0].y -= delta.y
        }

        this.ancestorScrolls.set(target, current)

        // Trigger update to fire onMove with new offset
        frame.update(this.updatePoint, true)
    }

    /**
     * Handle window scroll.
     * Adjusts lastMoveEventInfo to compensate for scroll, since pageX/pageY
     * would have changed if a real pointer event had fired.
     */
    private handleWindowScroll = (): void => {
        const current = { x: window.scrollX, y: window.scrollY }
        const delta = {
            x: current.x - this.windowScroll.x,
            y: current.y - this.windowScroll.y,
        }

        if (delta.x === 0 && delta.y === 0) return

        // For window scroll, pageX/pageY changes with scroll.
        // Update lastMoveEventInfo to reflect what pageX/pageY would be.
        if (this.lastMoveEventInfo) {
            this.lastMoveEventInfo.point.x += delta.x
            this.lastMoveEventInfo.point.y += delta.y
        }

        this.windowScroll = current

        // Trigger update to fire onMove
        frame.update(this.updatePoint, true)
    }

    private updatePoint = () => {
        if (!(this.lastMoveEvent && this.lastMoveEventInfo)) return

        const info = getPanInfo(this.lastMoveEventInfo, this.history)
        const isPanStarted = this.startEvent !== null

        // Only start panning if the offset is larger than 3 pixels. If we make it
        // any larger than this we'll want to reset the pointer history
        // on the first update to avoid visual snapping to the cursor.
        const isDistancePastThreshold =
            distance2D(info.offset, { x: 0, y: 0 }) >= this.distanceThreshold

        if (!isPanStarted && !isDistancePastThreshold) return

        const { point } = info
        const { timestamp } = frameData
        this.history.push({ ...point, timestamp })

        const { onStart, onMove } = this.handlers

        if (!isPanStarted) {
            onStart && onStart(this.lastMoveEvent, info)
            this.startEvent = this.lastMoveEvent
        }

        onMove && onMove(this.lastMoveEvent, info)
    }

    private handlePointerMove = (event: PointerEvent, info: EventInfo) => {
        this.lastMoveEvent = event
        this.lastMoveEventInfo = transformPoint(info, this.transformPagePoint)

        // Throttle mouse move event to once per frame
        frame.update(this.updatePoint, true)
    }

    private handlePointerUp = (event: PointerEvent, info: EventInfo) => {
        this.end()

        const { onEnd, onSessionEnd, resumeAnimation } = this.handlers

        if (this.dragSnapToOrigin) resumeAnimation && resumeAnimation()
        if (!(this.lastMoveEvent && this.lastMoveEventInfo)) return

        const panInfo = getPanInfo(
            event.type === "pointercancel"
                ? this.lastMoveEventInfo
                : transformPoint(info, this.transformPagePoint),
            this.history
        )

        if (this.startEvent && onEnd) {
            onEnd(event, panInfo)
        }

        onSessionEnd && onSessionEnd(event, panInfo)
    }

    updateHandlers(handlers: Partial<PanSessionHandlers>) {
        this.handlers = handlers
    }

    end() {
        this.removeListeners && this.removeListeners()
        this.removeScrollListeners && this.removeScrollListeners()
        this.ancestorScrolls.clear()
        cancelFrame(this.updatePoint)
    }
}

function transformPoint(
    info: EventInfo,
    transformPagePoint?: (point: Point) => Point
) {
    return transformPagePoint ? { point: transformPagePoint(info.point) } : info
}

function subtractPoint(a: Point, b: Point): Point {
    return { x: a.x - b.x, y: a.y - b.y }
}

function getPanInfo({ point }: EventInfo, history: TimestampedPoint[]) {
    return {
        point,
        delta: subtractPoint(point, lastDevicePoint(history)),
        offset: subtractPoint(point, startDevicePoint(history)),
        velocity: getVelocity(history, 0.1),
    }
}

function startDevicePoint(history: TimestampedPoint[]): TimestampedPoint {
    return history[0]
}

function lastDevicePoint(history: TimestampedPoint[]): TimestampedPoint {
    return history[history.length - 1]
}

function getVelocity(history: TimestampedPoint[], timeDelta: number): Point {
    if (history.length < 2) {
        return { x: 0, y: 0 }
    }

    let i = history.length - 1
    let timestampedPoint: TimestampedPoint | null = null
    const lastPoint = lastDevicePoint(history)
    while (i >= 0) {
        timestampedPoint = history[i]
        if (
            lastPoint.timestamp - timestampedPoint.timestamp >
            secondsToMilliseconds(timeDelta)
        ) {
            break
        }
        i--
    }

    if (!timestampedPoint) {
        return { x: 0, y: 0 }
    }

    const time = millisecondsToSeconds(
        lastPoint.timestamp - timestampedPoint.timestamp
    )
    if (time === 0) {
        return { x: 0, y: 0 }
    }

    const currentVelocity = {
        x: (lastPoint.x - timestampedPoint.x) / time,
        y: (lastPoint.y - timestampedPoint.y) / time,
    }

    if (currentVelocity.x === Infinity) {
        currentVelocity.x = 0
    }
    if (currentVelocity.y === Infinity) {
        currentVelocity.y = 0
    }

    return currentVelocity
}
