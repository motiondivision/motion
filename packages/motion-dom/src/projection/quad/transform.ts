import type { AnyResolvedKeyframe } from "../../animation/types"
import type { ResolvedValues } from "../../render/types"
import type { Mat3 } from "./mat3"

/**
 * Build CSS transforms as 4x4 matrices (row-major, column vectors), then
 * reduce them to the homography they apply to the element's own z = 0
 * plane. Transform functions within one element compose in 3D, so they're
 * multiplied as 4x4s. Flat (non preserve-3d) elements then compose as
 * homographies.
 *
 * Each transform function right-multiplies the shared scratch matrix in
 * place, touching only the columns it changes.
 */
const m = /* @__PURE__ */ new Float64Array(16)

function resetMatrix() {
    for (let i = 0; i < 16; i++) m[i] = i % 5 === 0 ? 1 : 0
}

function translate(x: number, y: number, z: number) {
    for (let r = 0; r < 16; r += 4) {
        m[r + 3] += m[r] * x + m[r + 1] * y + m[r + 2] * z
    }
}

function scale(x: number, y: number, z = 1) {
    for (let r = 0; r < 16; r += 4) {
        m[r] *= x
        m[r + 1] *= y
        m[r + 2] *= z
    }
}

/**
 * Rotate the plane spanned by columns i and j. rotateZ is (0, 1),
 * rotateX (1, 2) and rotateY (2, 0).
 */
function rotate(degrees: number, i: number, j: number) {
    const angle = (degrees * Math.PI) / 180
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    for (let r = 0; r < 16; r += 4) {
        const a = m[r + i]
        const b = m[r + j]
        m[r + i] = a * cos + b * sin
        m[r + j] = b * cos - a * sin
    }
}

/**
 * Shear column `into` by column `from`: skewX is (1, 0), skewY (0, 1).
 */
function skew(degrees: number, into: number, from: number) {
    const t = Math.tan((degrees * Math.PI) / 180)
    for (let r = 0; r < 16; r += 4) m[r + into] += m[r + from] * t
}

function perspective(distance: number) {
    const k = -1 / distance
    for (let r = 0; r < 16; r += 4) m[r + 2] += m[r + 3] * k
}

/**
 * Move the transform's origin to (x, y, z): `T(o) * m * T(-o)`.
 */
function setOrigin(x: number, y: number, z: number) {
    translate(-x, -y, -z)
    for (let c = 0; c < 4; c++) {
        const w = m[12 + c]
        m[c] += x * w
        m[4 + c] += y * w
        m[8 + c] += z * w
    }
}

/**
 * Apply a parent's `perspective` (distance, originX, originY) after the
 * element's own transform: `T(po) * Persp * T(-po) * m`.
 */
function applyParentPerspective(perspective: Float64Array) {
    const distance = perspective[0]
    if (!distance) return
    const x = perspective[1]
    const y = perspective[2]
    const k = -1 / distance
    for (let c = 0; c < 4; c++) {
        m[c] -= x * m[12 + c]
        m[4 + c] -= y * m[12 + c]
        m[12 + c] += k * m[8 + c]
        m[c] += x * m[12 + c]
        m[4 + c] += y * m[12 + c]
    }
}

function reduce(out: Mat3) {
    out[0] = m[0]
    out[1] = m[1]
    out[2] = m[3]
    out[3] = m[4]
    out[4] = m[5]
    out[5] = m[7]
    out[6] = m[12]
    out[7] = m[13]
    out[8] = m[15]
    return out
}

function toNumber(value: AnyResolvedKeyframe | undefined, length = 0) {
    if (value === undefined) return 0
    if (typeof value === "number") return value
    const parsed = parseFloat(value)
    return value.endsWith("%") ? (parsed / 100) * length : parsed || 0
}

function toScale(value: AnyResolvedKeyframe | undefined) {
    return value === undefined ? 1 : toNumber(value)
}

/**
 * The transform Motion renders for `values` (see `buildTransform`) on an
 * element laid out at (x, y, width, height) on the page, as a page-space
 * homography of the element's plane.
 */
export function valuesToHomography(
    out: Mat3,
    values: ResolvedValues,
    x: number,
    y: number,
    width: number,
    height: number,
    parentPerspective?: Float64Array
): Mat3 {
    resetMatrix()

    const { transformPerspective, scale: uniformScale } = values
    transformPerspective && perspective(toNumber(transformPerspective))

    translate(
        toNumber(values.x, width) + toNumber(values.translateX, width),
        toNumber(values.y, height) + toNumber(values.translateY, height),
        toNumber(values.z) + toNumber(values.translateZ)
    )

    const s = toScale(uniformScale)
    scale(
        s * toScale(values.scaleX),
        s * toScale(values.scaleY),
        toScale(values.scaleZ)
    )

    applyRotations(values)

    setOrigin(
        x + width * originValue(values.originX),
        y + height * originValue(values.originY),
        toNumber(values.originZ)
    )

    parentPerspective && applyParentPerspective(parentPerspective)

    return reduce(out)
}

function originValue(value: AnyResolvedKeyframe | undefined) {
    return value === undefined ? 0.5 : (value as number)
}

/**
 * rotate, rotateX/Y/Z and skews, in `transformPropOrder`, then the
 * additive `pathRotation`.
 */
function applyRotations(values: ResolvedValues) {
    const { rotate: r, rotateX, rotateY, rotateZ, skewX, skewY } = values
    r && rotate(toNumber(r), 0, 1)
    rotateX && rotate(toNumber(rotateX), 1, 2)
    rotateY && rotate(toNumber(rotateY), 2, 0)
    rotateZ && rotate(toNumber(rotateZ), 0, 1)
    values.skew && skew(toNumber(values.skew), 1, 0)
    skewX && skew(toNumber(skewX), 1, 0)
    skewY && skew(toNumber(skewY), 0, 1)
    values.pathRotation && rotate(toNumber(values.pathRotation), 0, 1)
}

/**
 * The transform `buildProjectionTransform` renders, as a page-space
 * homography, for an element laid out at `box` with the given projection
 * delta and tree scale. `values` are the lead's rendered values.
 */
export function projectionToHomography(
    out: Mat3,
    translateX: number,
    translateY: number,
    scaleX: number,
    scaleY: number,
    treeScaleX: number,
    treeScaleY: number,
    originX: number,
    originY: number,
    values?: ResolvedValues
): Mat3 {
    resetMatrix()

    if (values) {
        const { transformPerspective, pathRotation } = values
        transformPerspective && perspective(toNumber(transformPerspective))
        translate(
            translateX / treeScaleX,
            translateY / treeScaleY,
            toNumber(values.z)
        )
        scale(1 / treeScaleX, 1 / treeScaleY)
        const { rotate: r, rotateX, rotateY, rotateZ, skewX, skewY } = values
        r && rotate(toNumber(r), 0, 1)
        pathRotation && rotate(toNumber(pathRotation), 0, 1)
        rotateX && rotate(toNumber(rotateX), 1, 2)
        rotateY && rotate(toNumber(rotateY), 2, 0)
        rotateZ && rotate(toNumber(rotateZ), 0, 1)
        skewX && skew(toNumber(skewX), 1, 0)
        skewY && skew(toNumber(skewY), 0, 1)
    } else {
        translate(translateX / treeScaleX, translateY / treeScaleY, 0)
        scale(1 / treeScaleX, 1 / treeScaleY)
    }

    scale(scaleX * treeScaleX, scaleY * treeScaleY)
    setOrigin(originX, originY, 0)

    return reduce(out)
}

/**
 * Whether `values` hold a transform that turns, shears or foreshortens an
 * element, which a box can't describe.
 */
export const hasNonAxisAlignedTransform = (values: ResolvedValues) =>
    Boolean(
        values.rotate ||
            values.rotateX ||
            values.rotateY ||
            values.rotateZ ||
            values.skew ||
            values.skewX ||
            values.skewY ||
            values.pathRotation
    )
