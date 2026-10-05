import { clamp, progress, velocityPerSecond } from "motion-utils"
import { AxisScrollInfo, ScrollInfo } from "./types"

/**
 * A time in milliseconds, beyond which we consider the scroll velocity to be 0.
 */
const maxElapsed = 50

const createAxisInfo = (): AxisScrollInfo => ({
    current: 0,
    offset: [],
    progress: 0,
    scrollLength: 0,
    targetOffset: 0,
    targetLength: 0,
    containerLength: 0,
    velocity: 0,
})

export const createScrollInfo = (): ScrollInfo => ({
    time: 0,
    x: createAxisInfo(),
    y: createAxisInfo(),
})

/**
 * Also iterated with for...in as the list of axes.
 */
export const axisKeys = {
    x: {
        length: "Width",
        position: "Left",
    },
    y: {
        length: "Height",
        position: "Top",
    },
} as const

export type Axis = keyof typeof axisKeys

const styles = new WeakMap<Element, CSSStyleDeclaration>()

/**
 * Whether an axis scrolls from its end, which browsers report as a scroll
 * position running from 0 to -scrollLength (#3340). This is read from style
 * rather than the sign of the scroll position, as elastic overscroll pushes
 * the position past 0 in either kind of axis (#3791).
 */
function isReversed(element: Element, axisName: Axis) {
    let style = styles.get(element)
    if (!style) styles.set(element, (style = getComputedStyle(element)))

    const { writingMode, flexDirection } = style

    /**
     * The viewport doesn't adopt the root element's flex layout.
     */
    const isFlex =
        style.display.includes("flex") && element !== document.scrollingElement
    const mainReversed = isFlex && flexDirection.endsWith("reverse")
    const crossReversed = isFlex && style.flexWrap.endsWith("reverse")
    const isColumn = flexDirection[0] === "c"

    return (axisName === "x") !== /^[vs]/.test(writingMode)
        ? // Inline axis
          ((style.direction === "rtl") !== (writingMode === "sideways-lr")) !==
              (isColumn ? crossReversed : mainReversed)
        : // Block axis
          writingMode.endsWith("rl") !==
              (isColumn ? mainReversed : crossReversed)
}

function updateAxisInfo(
    element: Element,
    axisName: Axis,
    info: ScrollInfo,
    time: number
) {
    const axis = info[axisName]
    const { length, position } = axisKeys[axisName]

    const prev = axis.current
    const prevTime = info.time

    const scrollPosition = element[`scroll${position}`]
    axis.current = isReversed(element, axisName)
        ? -scrollPosition || 0 // Avoid -0
        : scrollPosition
    axis.containerLength = element[`client${length}`]
    axis.targetLength = element[`scroll${length}`]
    axis.scrollLength = axis.targetLength - axis.containerLength

    axis.offset.length = 0
    axis.offset[0] = 0
    axis.offset[1] = axis.scrollLength
    axis.progress = clamp(0, 1, progress(0, axis.scrollLength, axis.current))

    const elapsed = time - prevTime
    axis.velocity =
        elapsed > maxElapsed
            ? 0
            : velocityPerSecond(axis.current - prev, elapsed)
}

/**
 * Measures a scroll container. Runs once per container per frame; every
 * handler on that container derives its info from the result.
 */
export function updateScrollInfo(
    element: Element,
    info: ScrollInfo,
    time: number
) {
    for (const axis in axisKeys) {
        updateAxisInfo(element, axis as Axis, info, time)
    }
    info.time = time
}
