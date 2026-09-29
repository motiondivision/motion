export interface ScrollOptions {
    source?: HTMLElement
    container?: Element
    target?: Element
    axis?: "x" | "y"
    offset?: ScrollOffset
    /**
     * Where an animation starts, as progress from `0` to `1` through the
     * scroll range, or through the target's cover range when `target` is
     * set. Replaces `offset`. Before it, the animation holds its first
     * keyframe. Ignored by callbacks.
     */
    rangeStart?: number
    /**
     * Where an animation ends, as progress from `0` to `1`, after
     * `rangeStart`. After it, the animation holds its last keyframe.
     */
    rangeEnd?: number
}

export interface ScrollOptionsWithDefaults extends ScrollOptions {
    axis: "x" | "y"
    container: Element
}

export type OnScroll = (progress: number, info: ScrollInfo) => void

export interface AxisScrollInfo {
    current: number
    offset: number[]
    progress: number
    scrollLength: number
    velocity: number

    // TODO Rename before documenting
    targetOffset: number

    targetLength: number
    containerLength: number
}

export interface ScrollInfo {
    time: number
    x: AxisScrollInfo
    y: AxisScrollInfo
}

export type OnScrollInfo = (info: ScrollInfo) => void

export interface OnScrollHandler {
    measure: (containerInfo: ScrollInfo) => void
    notify: (containerInfo: ScrollInfo) => void
}

export type SupportedEdgeUnit = "px" | "vw" | "vh" | "%"

export type EdgeUnit = `${number}${SupportedEdgeUnit}`

export type NamedEdges = "start" | "end" | "center"

export type EdgeString = NamedEdges | EdgeUnit | `${number}`

export type Edge = EdgeString | number

export type ProgressIntersection = [number, number]

export type Intersection = `${Edge} ${Edge}`

export type ScrollOffset = Array<Edge | Intersection | ProgressIntersection>

export interface ScrollInfoOptions {
    container?: Element
    target?: Element
    axis?: "x" | "y"
    offset?: ScrollOffset
    /**
     * When true, enables per-frame checking of scrollWidth/scrollHeight
     * to detect content size changes and recalculate scroll progress.
     *
     * @default false
     */
    trackContentSize?: boolean
}
