import { EasingFunction } from "motion-utils"

export interface ScrollOptions {
    source?: HTMLElement
    container?: Element
    target?: Element
    axis?: "x" | "y"
    offset?: ScrollOffset
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
}
