import { ResolvedValues } from "../../types"

const dashKeys = {
    offset: "stroke-dashoffset",
    array: "stroke-dasharray",
}

const camelKeys = {
    offset: "strokeDashoffset",
    array: "strokeDasharray",
}

/**
 * Build SVG path properties. Uses the path's measured length to convert
 * our custom pathLength, pathSpacing and pathOffset into stroke-dashoffset
 * and stroke-dasharray attributes.
 *
 * This function is mutative to reduce per-frame GC.
 */
export function buildSVGPath(
    attrs: ResolvedValues,
    length: number | string,
    spacing: number | string = 1,
    offset: number | string = 0,
    useDashCase: boolean = true
): void {
    // Normalise path length by setting SVG attribute pathLength to 1
    attrs.pathLength = 1

    // We use dash case when setting attributes directly to the DOM node and camel case
    // when defining props on a React component.
    const keys = useDashCase ? dashKeys : camelKeys

    // Build the dash offset (unitless so zooming doesn't affect rendering)
    const offsetValue = typeof offset === "string" ? -parseFloat(offset) : -offset
    attrs[keys.offset] = `${offsetValue}`

    // Build the dash array (unitless for the same reason)
    const lengthValue = typeof length === "string" ? length : `${length}`
    const spacingValue = typeof spacing === "string" ? spacing : `${spacing}`
    attrs[keys.array] = `${lengthValue} ${spacingValue}`
}
