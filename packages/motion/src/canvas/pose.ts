/**
 * The values a canvas layer draws an element with. Lengths are CSS pixels
 * from the canvas origin to the element's top-left corner, rotate is in
 * degrees and origins are fractions of the element's size, as in CSS.
 */
export interface CanvasPose {
    x: number
    y: number
    scale: number
    scaleX: number
    scaleY: number
    rotate: number
    opacity: number
    originX: number
    originY: number
}

export type CanvasPoseKey = keyof CanvasPose

export const defaultPose: CanvasPose = {
    x: 0,
    y: 0,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    rotate: 0,
    opacity: 1,
    originX: 0.5,
    originY: 0.5,
}

export const poseKeys = Object.keys(defaultPose) as CanvasPoseKey[]

export const isPoseKey = (key: string): key is CanvasPoseKey =>
    key in defaultPose

/**
 * Read a pose from resolved values, which can hold strings like "10px"
 * when they're animated from the DOM.
 */
export function readPose(
    values: Record<string, unknown>,
    out = {} as CanvasPose
): CanvasPose {
    for (const key of poseKeys) {
        const value = values[key]
        const number =
            typeof value === "number" ? value : parseFloat(value as string)
        out[key] = isNaN(number) ? defaultPose[key] : number
    }
    return out
}

/**
 * The column-major 3x3 matrix that maps a point in a `width` x `height`
 * box to the canvas: translate(x, y), then rotate and scale around the
 * origin, in the same order as a CSS transform.
 */
export function poseMatrix(
    { x, y, scale, scaleX, scaleY, rotate, originX, originY }: CanvasPose,
    width: number,
    height: number,
    out = new Float32Array(9)
) {
    const radians = (rotate * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const sx = scale * scaleX
    const sy = scale * scaleY
    const ox = originX * width
    const oy = originY * height
    const a = cos * sx
    const b = sin * sx
    const c = -sin * sy
    const d = cos * sy

    out[0] = a
    out[1] = b
    out[2] = 0
    out[3] = c
    out[4] = d
    out[5] = 0
    out[6] = x + ox - (a * ox + c * oy)
    out[7] = y + oy - (b * ox + d * oy)
    out[8] = 1

    return out
}

/**
 * Mix two poses, `t` = 0 being `from` and 1 `to`.
 */
export function mixPose(
    from: CanvasPose,
    to: CanvasPose,
    t: number,
    out = {} as CanvasPose
) {
    for (const key of poseKeys) {
        out[key] = from[key] + (to[key] - from[key]) * t
    }
    return out
}

const corners = [0, 0, 1, 0, 0, 1, 1, 1]
const matrixA = new Float32Array(9)
const matrixB = new Float32Array(9)

/**
 * The furthest any corner of a `width` x `height` box moves between two
 * poses, in CSS pixels. Opacity alone doesn't move anything.
 */
export function poseTravel(
    a: CanvasPose,
    b: CanvasPose,
    width: number,
    height: number
) {
    const ma = poseMatrix(a, width, height, matrixA)
    const mb = poseMatrix(b, width, height, matrixB)
    let travel = 0

    for (let i = 0; i < 8; i += 2) {
        const px = corners[i] * width
        const py = corners[i + 1] * height
        const dx =
            ma[0] * px + ma[3] * py + ma[6] - (mb[0] * px + mb[3] * py + mb[6])
        const dy =
            ma[1] * px + ma[4] * py + ma[7] - (mb[1] * px + mb[4] * py + mb[7])
        travel = Math.max(travel, Math.hypot(dx, dy))
    }

    return travel
}

/**
 * The axis-aligned bounds, as [left, top, right, bottom] in CSS pixels, of
 * a `width` x `height` box drawn with every pose between `a` and `b`.
 * Rotation can bow a corner's path outwards, so the swept poses are
 * sampled along with the ends.
 */
export function sweptBounds(
    a: CanvasPose,
    b: CanvasPose,
    width: number,
    height: number,
    steps = 8
) {
    const bounds = [Infinity, Infinity, -Infinity, -Infinity]
    const pose = {} as CanvasPose

    for (let i = 0; i <= steps; i++) {
        const m = poseMatrix(
            mixPose(a, b, i / steps, pose),
            width,
            height,
            matrixA
        )

        for (let j = 0; j < 8; j += 2) {
            const px = corners[j] * width
            const py = corners[j + 1] * height
            const x = m[0] * px + m[3] * py + m[6]
            const y = m[1] * px + m[4] * py + m[7]
            bounds[0] = Math.min(bounds[0], x)
            bounds[1] = Math.min(bounds[1], y)
            bounds[2] = Math.max(bounds[2], x)
            bounds[3] = Math.max(bounds[3], y)
        }
    }

    return bounds
}

/**
 * How many sub-frame poses to average for a corner travel of `travel`
 * device pixels: about one every two pixels, at least 2 and at most
 * `max`.
 */
export const blurSamples = (travel: number, max: number) =>
    Math.max(2, Math.min(max, Math.ceil(travel / 2) + 1))
