import type { Box, Delta, Point, TransformPoint } from "motion-utils"
import type { TransformTemplate } from "../../node/types"
import { visualElementStore } from "../../render/store"
import type { ResolvedValues } from "../../render/types"
import { copyBoxInto } from "../geometry/copy"
import { createBox, createDelta } from "../geometry/models"
import {
    compose,
    createComponents,
    decompose,
    HomographyComponents,
    unwrapRotation,
} from "../quad/decompose"
import {
    conjugateTranslate,
    copyMat3,
    createMat3,
    identity,
    invert,
    isAxisAligned,
    isIdentity,
    Mat3,
    mat3Equals,
    multiply,
    rectToRect,
    toMatrix3d,
} from "../quad/mat3"
import {
    measureSpace,
    neutraliseLayers,
    SpaceMeasurement,
} from "../quad/measure-space"
import {
    boxToQuad,
    copyQuad,
    createQuad,
    Quad,
    quadFromBox,
    transformBoxToQuad,
    transformQuad,
} from "../quad/quad"
import {
    hasNonAxisAlignedTransform,
    projectionToHomography,
    valuesToHomography,
} from "../quad/transform"
import type { LayoutEngine } from "./layout-engine"
import type { IProjectionNode, Measurements, QuadMeasurements } from "./types"

/**
 * Quad projection
 *
 * The box engine describes every element as an axis-aligned box and every
 * projection as a translate and scale. That's exact, and fast, until an
 * element is drawn in a rotated, skewed or 3D space: its box is then only
 * the bounding box of what's visible, and a translate/scale can't move one
 * quad onto another.
 *
 * Quad projection describes an element as the four corners it's visible at
 * and its transforms as page-space homographies, which map any quad onto any
 * other. A layout animation decomposes the homographies at each end into
 * translate, rotate, scale, skew and perspective, mixes those, and renders
 * the result as a `matrix3d()`.
 *
 * Nodes only take this path when a box can't describe them, so the box
 * engine still handles, unchanged, every layout animation it could.
 *
 * Everything here works on preallocated typed arrays: nothing is allocated
 * per frame.
 */
export interface QuadProjection {
    /**
     * Whether this node is rendering a quad projection.
     */
    active: boolean

    /**
     * The lead's start components have been resolved against its space.
     */
    resolved: boolean

    progress: number

    /**
     * The snapshot's corners on the page.
     */
    origin: Quad

    /**
     * Where the snapshot's corners sit in this node's space, and the
     * components of the homography from `rect` onto them.
     */
    local: Quad
    from: HomographyComponents

    /**
     * Components of the node's live transform, the same when the
     * animation resolved, and the mix.
     */
    to: HomographyComponents
    base: HomographyComponents
    mixed: HomographyComponents

    /**
     * Whether the node took over from another (a shared layout animation).
     */
    isShared: boolean

    /**
     * Rotation to add to the shortest path, in degrees, when the snapshot
     * and lead have numeric rotations a whole turn or more apart.
     */
    turns: number

    /**
     * The page-space homography of everything this node is drawn in: its
     * projection parent's visual transform, then the environment between.
     */
    space: Mat3

    /**
     * This node's own transform, in page space.
     */
    output: Mat3

    /**
     * `space * output`: how the node maps from its layout to the page.
     */
    visual: Mat3

    /**
     * The untransformed page box `output` applies to.
     */
    rect: Box

    /**
     * A stand-in node for scale correctors, which read the projected size
     * from `target`, `projectionDelta` and `treeScale`.
     */
    correction: {
        target: Box
        projectionDelta: Delta
        treeScale: Point
    }
}

export function createQuadProjection(): QuadProjection {
    return {
        active: false,
        resolved: false,
        progress: 0,
        origin: createQuad(),
        local: createQuad(),
        from: createComponents(),
        to: createComponents(),
        base: createComponents(),
        mixed: createComponents(),
        isShared: false,
        turns: 0,
        space: createMat3(),
        output: createMat3(),
        visual: createMat3(),
        rect: createBox(),
        correction: {
            target: createBox(),
            projectionDelta: createDelta(),
            treeScale: { x: 1, y: 1 },
        },
    }
}

/**
 * Whether an element has a projection node, so the box engine accounts for
 * its transform.
 */
const isTracked = (element: Element) =>
    visualElementStore.get(element)?.projection?.instance === element

const space: SpaceMeasurement = {
    rect: /* @__PURE__ */ createBox(),
    env: /* @__PURE__ */ createMat3(),
    frame: /* @__PURE__ */ createMat3(),
    perspective: /* @__PURE__ */ new Float64Array(3),
    layers: [],
}

const has3DTransform = (values: ResolvedValues) =>
    Boolean(values.rotateX || values.rotateY || values.z)

/**
 * Whether a tracked node turns, shears or foreshortens its subtree.
 */
const isDistorting = (node: IProjectionNode) =>
    node !== node.root &&
    Boolean(hasNonAxisAlignedTransform(node.latestValues) || node.quad?.active)

const hasRotatedAncestor = (node: IProjectionNode) =>
    node.path.some(isDistorting)

const hasQuadAncestor = (node: IProjectionNode) =>
    node.path.some((ancestor) => ancestor.quad?.active)

const sourceOf = (node: IProjectionNode) =>
    node.resumeFrom || node.resumingFrom || node

/**
 * The box engine measures every tracked node with its rotations and skews
 * reset, and the DOM reapplies them on top of its boxes. That's exact for
 * a shared element if every distorting ancestor on either side is common to
 * both, or animates from the other side's matching ancestor, so it starts
 * at the rotation the snapshot was drawn with. Otherwise the element would
 * start in the wrong place.
 */
function boxCanHandOver(lead: IProjectionNode, prev: IProjectionNode) {
    for (const ancestor of lead.path) {
        if (
            isDistorting(ancestor) &&
            !prev.path.includes(ancestor) &&
            !prev.path.includes(sourceOf(ancestor))
        ) {
            return false
        }
    }

    for (const ancestor of prev.path) {
        if (
            isDistorting(ancestor) &&
            !lead.path.some((node) => sourceOf(node) === ancestor)
        ) {
            return false
        }
    }

    return true
}

/**
 * Whether two measurements were taken in the same space, so the box
 * engine can animate between their boxes. No measurement means no layers.
 */
function isSameSpace(
    a: QuadMeasurements | undefined,
    b: QuadMeasurements | undefined,
    is3D: boolean
) {
    if (a && b) {
        return (
            mat3Equals(a.frame, b.frame, 1e-4) &&
            (!is3D || isSamePerspective(a.perspective, b.perspective))
        )
    }

    const measured = a || b
    return (
        !measured ||
        (isIdentity(measured.frame, 1e-6) &&
            (!is3D || !measured.perspective[0]))
    )
}

const isSamePerspective = (a: Float64Array, b: Float64Array) =>
    a[0] === b[0] &&
    (!a[0] || (Math.abs(a[1] - b[1]) < 1e-4 && Math.abs(a[2] - b[2]) < 1e-4))

const wasScrollRoot = (node: IProjectionNode) =>
    node !== node.root && node.scroll?.wasRoot

/**
 * Whether a transformPagePoint function moves points. React's MotionConfig
 * always provides one, which leaves them where they are.
 */
const mapsPoints = (transform?: TransformPoint) => {
    const point = transform?.({ x: 1, y: 2 })
    return point && (point.x !== 1 || point.y !== 2)
}

/**
 * Read the space an element is drawn in, before its boxes are measured, and
 * neutralise its layers until they are. Returns undefined, the common case,
 * if no layer lies above it.
 */
export function readSpace(
    node: IProjectionNode,
    pass: number
): QuadMeasurements | undefined {
    const { instance, parent } = node

    /**
     * An app that maps page points itself (for instance to zoom a canvas)
     * measures in its own space.
     */
    if (
        !(instance instanceof Element) ||
        mapsPoints(node.options.visualElement?.getTransformPagePoint()) ||
        !measureSpace(
            instance,
            parent?.instance instanceof Element ? parent.instance : null,
            isTracked,
            pass,
            space
        )
    ) {
        return undefined
    }

    const quad: QuadMeasurements = {
        rect: createBox(),
        env: createMat3(),
        frame: createMat3(),
        perspective: new Float64Array(3),
        isQuadSpace: false,
    }

    copyBoxInto(quad.rect, space.rect)
    quad.env.set(space.env)
    quad.frame.set(space.frame)
    quad.perspective.set(space.perspective)

    /**
     * Viewport to page, unless the node or an ancestor was its own scroll
     * root, whose boxes stay in the viewport.
     */
    const scroll = node.root!.scroll?.offset
    if (scroll && !node.scroll?.wasRoot && !node.path.some(wasScrollRoot)) {
        const { x, y } = scroll
        quad.rect.x.min += x
        quad.rect.x.max += x
        quad.rect.y.min += y
        quad.rect.y.max += y
        conjugateTranslate(quad.env, quad.env, x, y)
        conjugateTranslate(quad.frame, quad.frame, x, y)
        quad.perspective[1] += x
        quad.perspective[2] += y
    }

    /**
     * Inside a layer, a node's boxes are measured in the layer's own
     * space, so the box engine still animates it exactly. Unless the
     * layer sits between it and a tracked parent: the box engine corrects
     * a node for its parent's projection, which the layer would distort.
     */
    quad.isQuadSpace =
        Boolean(parent && parent !== node.root) &&
        (!isAxisAligned(quad.env) ||
            Boolean(quad.perspective[0] && has3DTransform(node.latestValues)))

    if (space.layers.length) quad.restore = neutraliseLayers(space.layers)

    return quad
}

/**
 * Finish a node's quad measurements once its boxes are measured. For a
 * snapshot that might hand over to another space, record the corners it's
 * visible at.
 */
export function measureQuad(
    node: IProjectionNode,
    quad: QuadMeasurements | undefined,
    isSnapshot: boolean,
    layoutBox: Box
): QuadMeasurements | undefined {
    if (quad?.restore) {
        quad.restore()
        quad.restore = undefined
    }

    const needsVisual =
        isSnapshot &&
        (quad ||
            node.quad?.active ||
            hasQuadAncestor(node) ||
            (node.options.layoutId !== undefined &&
                (isDistorting(node) || hasRotatedAncestor(node))))

    if (!needsVisual) return quad

    if (!quad) {
        quad = {
            rect: createBox(),
            env: createMat3(),
            frame: createMat3(),
            perspective: new Float64Array(3),
            isQuadSpace: false,
        }
        copyBoxInto(quad.rect, layoutBox)
    }

    const { parent } = node
    quad.visual = createQuad()
    if (parent) {
        getVisual(parent, snapshotSpace)
    } else {
        identity(snapshotSpace)
    }
    multiply(snapshotSpace, snapshotSpace, quad.env)

    /**
     * A projecting node's transform applies to the layout it was
     * projected from, not the box just measured, which includes it.
     */
    const rect = node.quad?.active
        ? node.quad.rect
        : isBoxProjecting(node)
        ? layoutRect(node)!
        : quad.rect

    renderedTransform(node, rendered, rect, quad.perspective)
    multiply(snapshotSpace, snapshotSpace, rendered)
    transformBoxToQuad(quad.visual, snapshotSpace, rect)

    return quad
}

const snapshotSpace = /* @__PURE__ */ createMat3()
const rendered = /* @__PURE__ */ createMat3()

const layoutRect = (node: IProjectionNode) =>
    node.layout &&
    (node.layout.quad ? node.layout.quad.rect : node.layout.layoutBox)

const isBoxProjecting = (node: IProjectionNode) =>
    Boolean(node.projectionDelta && node.getLead().target && node.layout)

/**
 * The transform a node is currently rendering, as a page-space homography,
 * from its state rather than the DOM. During snapshots, rotations in the
 * DOM are briefly reset, so this is the only reliable source.
 */
export function renderedTransform(
    node: IProjectionNode,
    out: Mat3,
    rect = layoutRect(node),
    perspective = node.layout?.quad?.perspective
): Mat3 {
    const { quad } = node
    if (quad && quad.active) return copyMat3(out, quad.output)

    if (!rect) return identity(out)

    if (isBoxProjecting(node)) {
        const lead = node.getLead()
        node.applyTransformsToTarget()
        const delta = node.projectionDeltaWithTransform!
        const { x, y } = node.projectionDelta!
        const treeScale = node.treeScale!
        return projectionToHomography(
            out,
            delta.x.translate,
            delta.y.translate,
            delta.x.scale,
            delta.y.scale,
            treeScale.x,
            treeScale.y,
            rect.x.min + x.origin * (rect.x.max - rect.x.min),
            rect.y.min + y.origin * (rect.y.max - rect.y.min),
            lead.animationValues || lead.latestValues
        )
    }

    return valuesToHomography(
        out,
        node.latestValues,
        rect.x.min,
        rect.y.min,
        rect.x.max - rect.x.min,
        rect.y.max - rect.y.min,
        perspective
    )
}

/**
 * The space a node is drawn in: its parent's visual transform, then the
 * environment between them. While snapshots are taken, a node already
 * snapshotted is measured where it is now; its last layout could be stale,
 * or not measured yet.
 */
export function getSpace(node: IProjectionNode, out: Mat3): Mat3 {
    const { parent } = node

    /**
     * Parents project before their children, so a projecting parent's
     * visual is already this frame's, without walking the rest of the
     * tree.
     */
    parent?.quad?.active
        ? copyMat3(out, parent.quad.visual)
        : parent
        ? getVisual(parent, out)
        : identity(out)
    const env = (node.snapshot || node.layout)?.quad?.env
    return env ? multiply(out, out, env) : out
}

const visualRendered = /* @__PURE__ */ createMat3()

/**
 * How a node currently maps from its layout to the page.
 */
export function getVisual(node: IProjectionNode, out: Mat3): Mat3 {
    if (!node.parent) return identity(out)
    getSpace(node, out)
    return multiply(out, out, renderedTransform(node, visualRendered))
}

const numericRotation = (values: ResolvedValues) =>
    ((values.rotate as number) || 0) + ((values.rotateZ as number) || 0)

/**
 * Decide whether a starting layout animation needs quad projection, and if
 * so start it. Called once per animation.
 */
export function startQuadAnimation(
    node: IProjectionNode,
    snapshot: Measurements | undefined,
    isShared: boolean
): boolean {
    const { layout, parent } = node
    const snapshotQuad = snapshot?.quad

    const prev = node.resumeFrom || node.resumingFrom

    const engage =
        layout &&
        snapshot &&
        ((parent && parent.quad?.active) ||
            layout.quad?.isQuadSpace ||
            snapshotQuad?.isQuadSpace ||
            !isSameSpace(
                snapshotQuad,
                layout.quad,
                has3DTransform(node.latestValues)
            ) ||
            (isShared && prev && !boxCanHandOver(node, prev)))

    if (!engage) {
        if (node.quad) node.quad.active = false
        return false
    }

    const quad = (node.quad ||= createQuadProjection())
    quad.active = true
    quad.resolved = false
    quad.isShared = isShared

    if (snapshotQuad?.visual) {
        copyQuad(quad.origin, snapshotQuad.visual)
    } else {
        quadFromBox(quad.origin, snapshot.measuredBox)
    }

    copyBoxInto(quad.rect, layoutRect(node)!)

    quad.turns = isShared
        ? numericRotation(node.latestValues) -
          numericRotation(snapshot.latestValues)
        : 0

    /**
     * Quad projection resolves its own target, so the box engine's
     * targets are left unset.
     */
    node.targetDelta = node.relativeTarget = undefined
    node.relativeTargetOrigin = node.relativeParent = undefined
    node.attemptToResolveRelativeTarget = false

    node.mixTargetDelta = (latest: number) => {
        quad.progress = node.animationProgress = latest / 1000
        node.mixShared?.()
        node.root!.scheduleUpdateProjection()
        node.scheduleRender()
    }
    node.mixTargetDelta(node.options.layoutRoot ? 1000 : 0)

    return true
}

const TAU = Math.PI * 2
const live = /* @__PURE__ */ createMat3()
const inverse = /* @__PURE__ */ createMat3()
const start = /* @__PURE__ */ createMat3()

/**
 * Per frame, for every node whose lead is projecting a quad. Follow nodes
 * are projected onto their lead once every lead has been, in
 * calcQuadFollow.
 */
function calcQuadProjection(node: IProjectionNode, lead: IProjectionNode) {
    node.isTreeAnimating = true
    if (lead === node && node.layout) {
        calcQuadLead(node)
        node.scheduleRender()
    }
}

/**
 * Mix the lead's start and live components into its own transform.
 */
export function calcQuadLead(node: IProjectionNode) {
    const quad = node.quad!
    const { rect, from, to, base, mixed } = quad
    const cx = (rect.x.min + rect.x.max) / 2
    const cy = (rect.y.min + rect.y.max) / 2

    getSpace(node, quad.space)

    /**
     * The lead's own transforms, read live so the animation always lands
     * on them, even if they change while it plays.
     */
    const previousRotation = to[2]
    const { width, height } = size(rect)
    if (!node.measureTransform?.(rect, live)) {
        valuesToHomography(
            live,
            node.latestValues,
            rect.x.min,
            rect.y.min,
            width,
            height,
            node.layout?.quad?.perspective
        )
    }
    decompose(to, live, cx, cy)

    if (!quad.resolved) {
        /**
         * Pull the snapshot's corners back into the lead's space. Resolving
         * here, on the first frame, rather than when the animation starts,
         * keeps the start pinned to the snapshot even if the space moves
         * before the animation starts.
         */
        if (
            !invert(inverse, quad.space) ||
            !transformQuad(quad.local, inverse, quad.origin) ||
            !boxToQuad(start, rect, quad.local) ||
            !decompose(from, start, cx, cy)
        ) {
            from.set(to)
        }

        unwrapRotation(from, to[2])
        if (quad.turns) {
            const shortest = to[2] - from[2]
            from[2] -=
                Math.round(((quad.turns * Math.PI) / 180 - shortest) / TAU) *
                TAU
        }
        base.set(to)
        quad.resolved = true
    } else {
        unwrapRotation(to, previousRotation)
    }

    mixToLive(mixed, from, base, to, quad.progress, quad.isShared)
    constrain(mixed, to, node.options.animationType, from)

    compose(quad.output, mixed, cx, cy)
    multiply(quad.visual, quad.space, quad.output)
}

/**
 * Mix from the snapshot towards the node's transform as it was when the
 * animation resolved, then add how that transform has changed since, as
 * the box engine does. Changes to position and scale apply in full, so an
 * element dragged mid-animation tracks the pointer. A shared element's
 * rotation, skew and perspective instead mix towards their live values,
 * as the box engine mixes a shared element's rotate.
 */
function mixToLive(
    out: HomographyComponents,
    from: HomographyComponents,
    base: HomographyComponents,
    live: HomographyComponents,
    progress: number,
    isShared: boolean
) {
    for (let i = 0; i < 8; i++) {
        const mixed = from[i] + (base[i] - from[i]) * progress
        const change = live[i] - base[i]

        if ((i === 3 || i === 4) && base[i]) {
            out[i] = mixed * (live[i] / base[i])
        } else {
            out[i] = mixed + (isShared && i > 1 ? change * progress : change)
        }
    }
}

/**
 * Hold the components `animationType` doesn't animate at their target.
 */
function constrain(
    mixed: HomographyComponents,
    to: HomographyComponents,
    animationType: string | undefined,
    from: HomographyComponents
) {
    switch (animationType) {
        case "position":
            for (let i = 2; i < 8; i++) mixed[i] = to[i]
            break
        case "size":
            mixed[0] = to[0]
            mixed[1] = to[1]
            break
        case "x":
            mixed[1] = to[1]
            mixed[4] = to[4]
            break
        case "y":
            mixed[0] = to[0]
            mixed[3] = to[3]
            break
        case "preserve-aspect":
            if (Math.abs(from[3] / from[4] - to[3] / to[4]) > 0.2) {
                constrain(mixed, to, "position", from)
            }
            break
    }
}

const fit = /* @__PURE__ */ createMat3()

/**
 * Per frame, after every lead: project a follow node onto its lead's quad.
 */
export function calcQuadFollow(node: IProjectionNode) {
    const lead = node.getLead()
    const leadQuad = lead.quad
    if (lead === node || !leadQuad?.active || !leadQuad.resolved) return

    const rect = layoutRect(node)
    if (!rect) return

    const quad = (node.quad ||= createQuadProjection())
    copyBoxInto(quad.rect, rect)
    getSpace(node, quad.space)

    if (!invert(inverse, quad.space)) return

    const from = size(rect)
    const fromWidth = from.width
    const fromHeight = from.height
    const to = size(leadQuad.rect)
    rectToRect(
        fit,
        rect.x.min,
        rect.y.min,
        fromWidth,
        fromHeight,
        leadQuad.rect.x.min,
        leadQuad.rect.y.min,
        to.width,
        to.height
    )

    multiply(quad.visual, leadQuad.visual, fit)
    multiply(quad.output, inverse, quad.visual)
    quad.mixed.set(leadQuad.mixed)
    quad.mixed[3] *= to.width / fromWidth
    quad.mixed[4] *= to.height / fromHeight
    quad.active = true
    node.scheduleRender(false)
}

const dimensions = { width: 0, height: 0 }

function size({ x, y }: Box) {
    dimensions.width = x.max - x.min
    dimensions.height = y.max - y.min
    return dimensions
}

export function stopQuadProjection(node: IProjectionNode) {
    if (node.quad) node.quad.active = false
    const stack = node.getStack()
    if (stack) {
        for (const member of stack.members) {
            if (member.quad) member.quad.active = false
        }
    }
}

const css = /* @__PURE__ */ createMat3()

/**
 * Render a node's quad projection, and return its transform.
 */
function applyQuadStyles(
    node: IProjectionNode,
    targetStyle: any,
    valuesToRender: ResolvedValues,
    transformTemplate: TransformTemplate | undefined
) {
    const originX = (node.latestValues.originX as number) ?? 0.5
    const originY = (node.latestValues.originY as number) ?? 0.5

    let transform = quadTransform(node, originX, originY)
    if (transformTemplate) {
        transform = transformTemplate(valuesToRender, transform)
    }

    targetStyle.transform = transform
    targetStyle.transformOrigin = `${originX * 100}% ${originY * 100}% 0`

    node.hasProjected = true
    return transform
}

/**
 * The CSS transform for a node's quad projection, about `origin` (0-1 of
 * its box). Also sizes the stand-in node its scale correctors read.
 */
export function quadTransform(
    node: IProjectionNode,
    originX: number,
    originY: number
): string {
    const { output, rect, mixed, correction } = node.quad!
    const { width, height } = size(rect)
    const x = rect.x.min + originX * width
    const y = rect.y.min + originY * height

    /**
     * `output` acts on page coordinates. CSS applies it in the element's
     * own, from its transform-origin.
     */
    conjugateTranslate(css, output, -x, -y)

    /**
     * Visible size, as scale correctors expect from a projected node.
     */
    const scaleX = Math.abs(mixed[3])
    const scaleY = Math.abs(mixed[4])
    correction.target.x.max = width * scaleX
    correction.target.y.max = height * scaleY
    correction.projectionDelta.x.scale = scaleX
    correction.projectionDelta.y.scale = scaleY

    return toMatrix3d(css)
}

/**
 * Projects elements from any quad, in any transformed space, onto any
 * other, with homographies.
 */
export const quadLayout: LayoutEngine = {
    readSpace,
    measureQuad,
    startAnimation: startQuadAnimation,
    calcLead: calcQuadProjection,
    calcFollow: calcQuadFollow,
    applyStyles: applyQuadStyles,
    stop: stopQuadProjection,
}
