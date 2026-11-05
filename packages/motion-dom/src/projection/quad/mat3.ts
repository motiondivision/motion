/**
 * 3x3 homographies, stored row-major and applied to column vectors
 * (x, y, 1):
 *
 *     | 0 1 2 |   | x |
 *     | 3 4 5 | * | y |
 *     | 6 7 8 |   | 1 |
 *
 * A homography maps any quad onto any other quad, so it describes how a
 * flat element appears after every 2D and 3D transform and perspective
 * acting on it. Axis-aligned boxes and translate/scale deltas are the
 * special case where only entries 0, 2, 4 and 5 differ from identity.
 *
 * Every function writes into `out` and allocates nothing, so they can run
 * every frame. `out` may alias any input.
 */
export type Mat3 = Float64Array

export function identity(out: Mat3): Mat3 {
    out[0] = 1
    out[1] = 0
    out[2] = 0
    out[3] = 0
    out[4] = 1
    out[5] = 0
    out[6] = 0
    out[7] = 0
    out[8] = 1
    return out
}

export const createMat3 = (): Mat3 => identity(new Float64Array(9))

export function copyMat3(out: Mat3, a: Mat3): Mat3 {
    for (let i = 0; i < 9; i++) out[i] = a[i]
    return out
}

/**
 * `out = a * b`: apply `b`, then `a`.
 */
export function multiply(out: Mat3, a: Mat3, b: Mat3): Mat3 {
    const a0 = a[0],
        a1 = a[1],
        a2 = a[2],
        a3 = a[3],
        a4 = a[4],
        a5 = a[5],
        a6 = a[6],
        a7 = a[7],
        a8 = a[8]
    const b0 = b[0],
        b1 = b[1],
        b2 = b[2],
        b3 = b[3],
        b4 = b[4],
        b5 = b[5],
        b6 = b[6],
        b7 = b[7],
        b8 = b[8]

    out[0] = a0 * b0 + a1 * b3 + a2 * b6
    out[1] = a0 * b1 + a1 * b4 + a2 * b7
    out[2] = a0 * b2 + a1 * b5 + a2 * b8
    out[3] = a3 * b0 + a4 * b3 + a5 * b6
    out[4] = a3 * b1 + a4 * b4 + a5 * b7
    out[5] = a3 * b2 + a4 * b5 + a5 * b8
    out[6] = a6 * b0 + a7 * b3 + a8 * b6
    out[7] = a6 * b1 + a7 * b4 + a8 * b7
    out[8] = a6 * b2 + a7 * b5 + a8 * b8
    return out
}

/**
 * Invert `a` into `out`. Returns false, leaving `out` untouched, if `a` is
 * singular (for instance an element scaled to 0 or turned edge-on).
 */
export function invert(out: Mat3, a: Mat3): boolean {
    const a0 = a[0],
        a1 = a[1],
        a2 = a[2],
        a3 = a[3],
        a4 = a[4],
        a5 = a[5],
        a6 = a[6],
        a7 = a[7],
        a8 = a[8]

    const c0 = a4 * a8 - a5 * a7
    const c3 = a5 * a6 - a3 * a8
    const c6 = a3 * a7 - a4 * a6
    const det = a0 * c0 + a1 * c3 + a2 * c6

    if (!det || !isFinite(det)) return false

    const inv = 1 / det
    out[0] = c0 * inv
    out[1] = (a2 * a7 - a1 * a8) * inv
    out[2] = (a1 * a5 - a2 * a4) * inv
    out[3] = c3 * inv
    out[4] = (a0 * a8 - a2 * a6) * inv
    out[5] = (a2 * a3 - a0 * a5) * inv
    out[6] = c6 * inv
    out[7] = (a1 * a6 - a0 * a7) * inv
    out[8] = (a0 * a4 - a1 * a3) * inv
    return true
}

/**
 * Scale `m` so its bottom-right entry is 1. Homographies are only defined
 * up to scale, so this doesn't change the mapping, but it makes entries
 * comparable. Returns false if the entry is 0.
 */
export function normalise(m: Mat3): boolean {
    const w = m[8]
    if (!w || !isFinite(w)) return false
    if (w !== 1) {
        const inv = 1 / w
        for (let i = 0; i < 8; i++) m[i] *= inv
        m[8] = 1
    }
    return true
}

/**
 * `out = T(x, y) * m`: translate after applying `m`.
 */
export function preTranslate(out: Mat3, m: Mat3, x: number, y: number) {
    const m6 = m[6],
        m7 = m[7],
        m8 = m[8]
    out[0] = m[0] + x * m6
    out[1] = m[1] + x * m7
    out[2] = m[2] + x * m8
    out[3] = m[3] + y * m6
    out[4] = m[4] + y * m7
    out[5] = m[5] + y * m8
    out[6] = m6
    out[7] = m7
    out[8] = m8
    return out
}

/**
 * `out = m * T(x, y)`: translate before applying `m`.
 */
export function postTranslate(out: Mat3, m: Mat3, x: number, y: number) {
    const m0 = m[0],
        m1 = m[1],
        m3 = m[3],
        m4 = m[4],
        m6 = m[6],
        m7 = m[7]
    out[0] = m0
    out[1] = m1
    out[2] = m0 * x + m1 * y + m[2]
    out[3] = m3
    out[4] = m4
    out[5] = m3 * x + m4 * y + m[5]
    out[6] = m6
    out[7] = m7
    out[8] = m6 * x + m7 * y + m[8]
    return out
}

/**
 * Conjugate `m` by a translation, `out = T(x, y) * m * T(-x, -y)`. This
 * moves a transform's origin, for instance from an element's
 * transform-origin to the page's.
 */
export function conjugateTranslate(out: Mat3, m: Mat3, x: number, y: number) {
    postTranslate(out, m, -x, -y)
    return preTranslate(out, out, x, y)
}

/**
 * Whether `m` keeps parallel lines parallel (no perspective).
 */
export const isAffine = (m: Mat3, epsilon = 1e-12) =>
    Math.abs(m[6]) <= epsilon * Math.abs(m[8]) &&
    Math.abs(m[7]) <= epsilon * Math.abs(m[8])

/**
 * Whether `m` only translates and scales, so boxes stay axis-aligned
 * boxes. These are the transforms the box engine handles exactly.
 */
export const isAxisAligned = (m: Mat3, epsilon = 1e-12) =>
    isAffine(m, epsilon) &&
    Math.abs(m[1]) <= epsilon * Math.abs(m[8]) &&
    Math.abs(m[3]) <= epsilon * Math.abs(m[8])

export function isIdentity(m: Mat3, epsilon = 1e-12) {
    const w = m[8]
    return (
        isAxisAligned(m, epsilon) &&
        Math.abs(m[0] - w) <= epsilon * Math.abs(w) &&
        Math.abs(m[4] - w) <= epsilon * Math.abs(w) &&
        Math.abs(m[2]) <= epsilon * Math.abs(w) &&
        Math.abs(m[5]) <= epsilon * Math.abs(w)
    )
}

/**
 * Map the rect (x, y, width, height) to the unit square.
 */
export function rectToUnit(
    out: Mat3,
    x: number,
    y: number,
    width: number,
    height: number
) {
    identity(out)
    out[0] = 1 / width
    out[2] = -x / width
    out[4] = 1 / height
    out[5] = -y / height
    return out
}

/**
 * Map the rect (x, y, width, height) onto the rect (tx, ty, tw, th).
 */
export function rectToRect(
    out: Mat3,
    x: number,
    y: number,
    width: number,
    height: number,
    tx: number,
    ty: number,
    tw: number,
    th: number
) {
    const sx = tw / width
    const sy = th / height
    identity(out)
    out[0] = sx
    out[2] = tx - x * sx
    out[4] = sy
    out[5] = ty - y * sy
    return out
}

/**
 * Serialise `m` as a CSS `matrix3d()`, which transforms z = 0 the same
 * way. CSS lists columns, not rows.
 */
export const toMatrix3d = (m: Mat3) =>
    `matrix3d(${m[0]}, ${m[3]}, 0, ${m[6]}, ${m[1]}, ${m[4]}, 0, ${m[7]}, 0, 0, 1, 0, ${m[2]}, ${m[5]}, 0, ${m[8]})`

/**
 * Whether `a` and `b` describe the same mapping, within `epsilon` of each
 * entry once both are normalised.
 */
export function mat3Equals(a: Mat3, b: Mat3, epsilon = 1e-6) {
    const wa = a[8]
    const wb = b[8]
    for (let i = 0; i < 9; i++) {
        if (Math.abs(a[i] / wa - b[i] / wb) > epsilon) return false
    }
    return true
}
