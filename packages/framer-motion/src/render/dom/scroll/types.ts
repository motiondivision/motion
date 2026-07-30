import { EasingFunction } from "motion-utils"

export interface ScrollOptions {
    source?: HTMLElement
    container?: Element
    target?: Element
    axis?: "x" | "y"
    offset?: ScrollOffset
    /**
     * The scroll position at which the animation becomes active, mirroring the
     * native WAAPI `rangeStart` (e.g. `"0%"`) or a `0`–`1` progress fraction.
     */
    rangeStart?: string | number
    /**
     * The scroll position at which the animation becomes inactive, mirroring the
     * native WAAPI `rangeEnd` (e.g. `"20%"`) or a `0`–`1` progress fraction.
     * Past this point the animation is removed so the CSS cascade (e.g. `:hover`)
     * can take over, matching native `animation-range`.
     */
    rangeEnd?: string | number
}

export interface ScrollOptionsWithDefaults extends ScrollOptions {
    axis: "x" | "y"
    container: Element
}

export type OnScrollProgress = (progress: number) => void
export type OnScrollWithInfo = (progress: number, info: ScrollInfo) => void

export type OnScroll = OnScrollProgress | OnScrollWithInfo

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
    interpolatorOffsets?: number[]
    interpolate?: EasingFunction
}

export interface ScrollInfo {
    time: number
    x: AxisScrollInfo
    y: AxisScrollInfo
}

export type OnScrollInfo = (info: ScrollInfo) => void

export type OnScrollHandler = {
    measure: (time: number) => void
    notify: () => void
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
