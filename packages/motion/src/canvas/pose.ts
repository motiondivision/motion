/**
 * The values a canvas layer draws an element with. Lengths are CSS pixels
 * from the canvas origin to the element's top-left corner, rotations are
 * in degrees and origins are fractions of the element's size, as in CSS.
 * `z` is towards the viewer. It, `rotateX` and `rotateY` are flat without
 * a perspective on the layer.
 */
export interface CanvasPose {
    x: number
    y: number
    z: number
    scale: number
    scaleX: number
    scaleY: number
    rotate: number
    rotateX: number
    rotateY: number
    opacity: number
    originX: number
    originY: number
}

export type CanvasPoseKey = keyof CanvasPose

export const defaultPose: CanvasPose = {
    x: 0,
    y: 0,
    z: 0,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    rotate: 0,
    rotateX: 0,
    rotateY: 0,
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
 * How a layer looks at its elements: [perspective, x, y]. The perspective
 * is the distance of the viewer from the canvas, as in CSS, with 0 for
 * none. The point (x, y) of the canvas is the one the viewer is in front
 * of.
 */
export type Camera = number[]

const noCamera: Camera = [0, 0, 0]

const toRadians = Math.PI / 180

/**
 * The column-major 3x3 matrix that maps a point (x, y, 1) of a `width` x
 * `height` box to the canvas, as (x * w, y * w, w): translate, then
 * scale, rotate, rotateX and rotateY around the origin, in the order
 * Motion builds a CSS transform, then the camera's perspective. Without
 * one, w is 1.
 */
export function poseMatrix(
    {
        x,
        y,
        z,
        scale,
        scaleX,
        scaleY,
        rotate,
        rotateX,
        rotateY,
        originX,
        originY,
    }: CanvasPose,
    width: number,
    height: number,
    out = new Float32Array(9),
    [perspective, centreX, centreY]: Camera = noCamera
) {
    const cosZ = Math.cos(rotate * toRadians)
    const sinZ = Math.sin(rotate * toRadians)
    const cosX = Math.cos(rotateX * toRadians)
    const sinX = Math.sin(rotateX * toRadians)
    const cosY = Math.cos(rotateY * toRadians)
    const sinY = Math.sin(rotateY * toRadians)
    const sx = scale * scaleX
    const sy = scale * scaleY
    const ox = originX * width
    const oy = originY * height

    /**
     * Where the box's x and y axes point after rotateY, then rotateX,
     * then rotate, then the scale.
     */
    const ax = sx * (cosZ * cosY - sinZ * sinX * sinY)
    const ay = sy * (sinZ * cosY + cosZ * sinX * sinY)
    const az = -cosX * sinY
    const bx = sx * -sinZ * cosX
    const by = sy * cosZ * cosX
    const bz = sinX

    const tx = x + ox - (ax * ox + bx * oy)
    const ty = y + oy - (ay * ox + by * oy)
    const tz = z - (az * ox + bz * oy)

    // A point at depth z is divided by 1 - z / perspective
    const k = perspective ? 1 / perspective : 0
    const kx = centreX * k
    const ky = centreY * k

    out[0] = ax - kx * az
    out[1] = ay - ky * az
    out[2] = -k * az
    out[3] = bx - kx * bz
    out[4] = by - ky * bz
    out[5] = -k * bz
    out[6] = tx - kx * tz
    out[7] = ty - ky * tz
    out[8] = 1 - k * tz

    return out
}

/**
 * Where a matrix from poseMatrix() draws the point (x, y) of its box. A
 * point behind the viewer is put far away.
 */
const point = [0, 0]
function project(m: Float32Array, x: number, y: number) {
    const w = Math.max(m[2] * x + m[5] * y + m[8], 1e-4)
    point[0] = (m[0] * x + m[3] * y + m[6]) / w
    point[1] = (m[1] * x + m[4] * y + m[7]) / w
    return point
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
    height: number,
    camera?: Camera
) {
    const ma = poseMatrix(a, width, height, matrixA, camera)
    const mb = poseMatrix(b, width, height, matrixB, camera)
    let travel = 0

    for (let i = 0; i < 8; i += 2) {
        const px = corners[i] * width
        const py = corners[i + 1] * height
        const [ax, ay] = project(ma, px, py)
        const [bx, by] = project(mb, px, py)
        travel = Math.max(travel, Math.hypot(ax - bx, ay - by))
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
    steps = 8,
    camera?: Camera
) {
    const bounds = [Infinity, Infinity, -Infinity, -Infinity]
    const pose = {} as CanvasPose

    for (let i = 0; i <= steps; i++) {
        const m = poseMatrix(
            mixPose(a, b, i / steps, pose),
            width,
            height,
            matrixA,
            camera
        )

        for (let j = 0; j < 8; j += 2) {
            const [x, y] = project(
                m,
                corners[j] * width,
                corners[j + 1] * height
            )
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
