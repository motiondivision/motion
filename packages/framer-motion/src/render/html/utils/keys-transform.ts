/**
 * Generate a list of every possible transform key.
 */
export const transformPropOrder = [
    "transformPerspective",
    "x",
    "y",
    "z",
    "translateX",
    "translateY",
    "translateZ",
    "scale",
    "scaleX",
    "scaleY",
    "rotate",
    "rotateX",
    "rotateY",
    "rotateZ",
    "skew",
    "skewX",
    "skewY",
]

/**
 * A quick lookup for transform props.
 */
export const transformProps = new Set(transformPropOrder)

type TransformValues = Record<
    (typeof transformPropOrder)[number],
    number | null
>

export const getTransformValues = (instance: HTMLElement): TransformValues => {
    const computedStyle = getComputedStyle(instance)
    const transform = computedStyle.transform || "none"

    // Default result object
    const result: TransformValues = Object.fromEntries(
        transformPropOrder.map((prop) => [prop, null])
    ) as TransformValues

    // If there's no transform applied, return the default object
    if (transform === "none") return result

    // Computed style of a transform returns either a 2D or 3D matrix,
    // we need to handle both cases.
    const matrix2DMatch = transform.match(/^matrix\(([-\d.e\s,]+)\)$/)
    const matrix3DMatch = transform.match(/^matrix3d\(([-\d.e\s,]+)\)$/)

    if (matrix2DMatch) {
        const values = matrix2DMatch[1]
            .split(",")
            .map((v) => parseFloat(v.trim()))
        if (values.length === 6) {
            result.translateX = values[4]
            result.translateY = values[5]
            result.x = result.translateX
            result.y = result.translateY
            result.scaleX = values[0]
            result.scaleY = values[3]
            result.scale = (Math.abs(values[0]) + Math.abs(values[3])) / 2
            result.skewX = Math.atan(values[1]) * (180 / Math.PI)
            result.skewY = Math.atan(values[2]) * (180 / Math.PI)
            result.skew = (Math.abs(values[1]) + Math.abs(values[2])) / 2
        }
    } else if (matrix3DMatch) {
        const values = matrix3DMatch[1]
            .split(",")
            .map((v) => parseFloat(v.trim()))
        if (values.length === 16) {
            result.translateX = values[12]
            result.translateY = values[13]
            result.translateZ = values[14]
            result.x = result.translateX
            result.y = result.translateY
            result.z = result.translateZ
            result.scaleX = values[0]
            result.scaleY = values[5]
            result.scale = (Math.abs(values[0]) + Math.abs(values[5])) / 2
            result.rotateX = Math.asin(-values[6]) * (180 / Math.PI)
            result.rotateY = Math.atan2(values[2], values[10]) * (180 / Math.PI)
            result.rotateZ = Math.atan2(values[4], values[0]) * (180 / Math.PI)
        }
    }

    return result
}

export const getTransformValue = (instance: HTMLElement, key: string) => {
    const values = getTransformValues(instance)
    return values[key as keyof TransformValues]
}
