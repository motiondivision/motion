import { Mat3, normalise, postTranslate } from "./mat3"

/**
 * A homography split into components that interpolate well, measured in a
 * frame centred on (cx, cy):
 *
 *     0 x, 1 y      where the centre lands
 *     2 rotate      radians
 *     3 scaleX, 4 scaleY
 *     5 skew        shear of y into x, before rotation
 *     6, 7          perspective, the projective row about the centre
 *
 * This is the 2D CSS matrix decomposition extended with a perspective
 * row: `m = T(x, y) * R(rotate) * Shear(skew) * S(scaleX, scaleY) * P`.
 * A translate/scale homography decomposes to rotate, skew and perspective
 * of 0, so mixing two of them is the same linear box interpolation as the
 * box engine.
 */
export type HomographyComponents = Float64Array

export const createComponents = (): HomographyComponents => new Float64Array(8)

const g = /* @__PURE__ */ new Float64Array(9)

/**
 * Returns false if `m` is degenerate at the centre.
 */
export function decompose(
    out: HomographyComponents,
    m: Mat3,
    cx: number,
    cy: number
): boolean {
    postTranslate(g, m, cx, cy)
    if (!normalise(g)) return false

    const px = g[6]
    const py = g[7]
    const x = g[2]
    const y = g[5]

    const a = g[0] - x * px
    const b = g[1] - x * py
    const c = g[3] - y * px
    const d = g[4] - y * py

    let scaleX = Math.sqrt(a * a + c * c)

    /**
     * Fold a reflection into a negative scale, rather than a half turn, so
     * flipping an element doesn't spin it. Same rule as CSS.
     */
    if (a * d - b * c < 0 && a < d) scaleX = -scaleX

    const rotate = scaleX ? Math.atan2(c / scaleX, a / scaleX) : 0
    const cos = Math.cos(rotate)
    const sin = Math.sin(rotate)

    out[0] = x
    out[1] = y
    out[2] = rotate
    out[3] = scaleX
    out[4] = d * cos - b * sin
    out[5] = b * cos + d * sin
    out[6] = px
    out[7] = py
    return true
}

export function compose(
    out: Mat3,
    components: HomographyComponents,
    cx: number,
    cy: number
): Mat3 {
    const x = components[0]
    const y = components[1]
    const cos = Math.cos(components[2])
    const sin = Math.sin(components[2])
    const scaleX = components[3]
    const scaleY = components[4]
    const skew = components[5]
    const px = components[6]
    const py = components[7]

    const a = cos * scaleX
    const b = cos * skew - sin * scaleY
    const c = sin * scaleX
    const d = sin * skew + cos * scaleY

    out[0] = a + x * px
    out[1] = b + x * py
    out[2] = x
    out[3] = c + y * px
    out[4] = d + y * py
    out[5] = y
    out[6] = px
    out[7] = py
    out[8] = 1

    return postTranslate(out, out, -cx, -cy)
}

const TAU = Math.PI * 2

/**
 * Move `components`' rotation by whole turns to within half a turn of
 * `reference`, so mixing towards it takes the shortest path.
 */
export function unwrapRotation(
    components: HomographyComponents,
    reference: number
) {
    components[2] -= Math.round((components[2] - reference) / TAU) * TAU
}

/**
 * Linearly mix every component. Unwrap rotations first.
 */
export function mixComponents(
    out: HomographyComponents,
    from: HomographyComponents,
    to: HomographyComponents,
    progress: number
) {
    for (let i = 0; i < 8; i++) {
        out[i] = from[i] + (to[i] - from[i]) * progress
    }
    return out
}
