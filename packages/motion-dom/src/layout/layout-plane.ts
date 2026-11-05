import type { Box } from "motion-utils"
import type { Transition } from "../animation/types"
import { frame } from "../frameloop"
import { createBox } from "../projection/geometry/models"
import { createProjectionNode } from "../projection/node/create-projection-node"
import { documentRoot } from "../projection/node/HTMLProjectionNode"
import { layoutEngine, setLayoutEngine } from "../projection/node/layout-engine"
import { quadLayout } from "../projection/node/quad-projection"
import type {
    IProjectionNode,
    Measurements,
    QuadMeasurements,
} from "../projection/node/types"
import {
    createMat3,
    identity,
    Mat3,
    multiply,
    preTranslate,
    rectToRect,
} from "../projection/quad/mat3"
import {
    boxToQuad,
    copyQuad,
    createQuad,
    Quad,
    quadBounds,
    transformBoxToQuad,
} from "../projection/quad/quad"
import type { ResolvedValues } from "../render/types"
import { VisualElement } from "../render/VisualElement"
import { layoutPlanes } from "./layout-planes"

/**
 * A flat rectangle drawn outside the DOM, like a plane in a WebGL scene,
 * that can take part in layout animations with elements.
 *
 * Corners are in viewport pixels, clockwise from top-left.
 */
export interface LayoutPlaneSource {
    /**
     * Write the corners the plane is laid out at, however Motion is
     * currently drawing it. Called when Motion measures layout, so it can
     * read the DOM (for instance, the canvas's position). Returns false if
     * the plane can't be seen.
     */
    measure(out: Quad): boolean

    /**
     * The same, every frame the plane animates, relative to what `measure`
     * last read. Mustn't read the DOM.
     */
    track(out: Quad): boolean

    /**
     * Draw the plane. `transform` maps the unit square onto where it's
     * drawn in the viewport, as a row-major 3x3 homography, or is undefined
     * to draw it where it's laid out.
     */
    render(transform: Mat3 | undefined, opacity: number, visible: boolean): void
}

export interface LayoutPlaneOptions {
    /**
     * Planes and elements with the same `layoutId` animate between each
     * other.
     */
    layoutId: string

    /**
     * The default transition, when animateLayout() doesn't set one.
     */
    transition?: Transition

    /**
     * Whether to crossfade with the element it animates to or from, while
     * both are shown. Defaults to true.
     */
    crossfade?: boolean

    /**
     * Whether the plane starts shown. Defaults to true.
     */
    visible?: boolean
}

export interface LayoutPlane {
    /**
     * Show the plane. Inside an animateLayout() update, it animates from
     * the element or plane it takes over from.
     */
    show(): void

    /**
     * Hide the plane. Inside an animateLayout() update, the element or plane
     * that takes over animates from it.
     */
    hide(): void
}

const measured = /* @__PURE__ */ createQuad()
const drawn = /* @__PURE__ */ createMat3()
const unit = /* @__PURE__ */ createMat3()

/**
 * Move viewport corners to the page, where layout is measured.
 */
function toPage(quad: Quad, node: IProjectionNode) {
    const scroll = node.root!.scroll?.offset
    if (!scroll) return
    for (let i = 0; i < 8; i += 2) {
        quad[i] += scroll.x
        quad[i + 1] += scroll.y
    }
}

/**
 * The rect a plane would fill if it faced the viewer: centred where its
 * diagonals cross, with the average width and height of its edges. Its
 * transform is the homography from this rect onto its corners.
 */
function naturalRect(out: Box, q: Quad) {
    const dx = q[0] - q[4]
    const dy = q[1] - q[5]
    const ex = q[2] - q[6]
    const ey = q[3] - q[7]
    const d = dx * ey - dy * ex
    const a = q[0] * q[5] - q[1] * q[4]
    const b = q[2] * q[7] - q[3] * q[6]
    const cx = d ? (a * ex - dx * b) / d : (q[0] + q[4]) / 2
    const cy = d ? (a * ey - dy * b) / d : (q[1] + q[5]) / 2
    const halfWidth =
        (Math.hypot(q[2] - q[0], q[3] - q[1]) +
            Math.hypot(q[4] - q[6], q[5] - q[7])) /
        4
    const halfHeight =
        (Math.hypot(q[6] - q[0], q[7] - q[1]) +
            Math.hypot(q[4] - q[2], q[5] - q[3])) /
        4
    out.x.min = cx - halfWidth
    out.x.max = cx + halfWidth
    out.y.min = cy - halfHeight
    out.y.max = cy + halfHeight
}

type PlaneNode = IProjectionNode<LayoutPlaneSource>

/**
 * Joining or leaving a stack outside an update hands its new lead a
 * snapshot that nothing animates from. Drop it, so the next update
 * doesn't animate from it either.
 */
function forget(node: IProjectionNode) {
    if (!node.root!.isUpdating) node.snapshot = node.resumeFrom = undefined
}

let PlaneProjectionNode:
    | (new (latestValues: ResolvedValues) => PlaneNode)
    | undefined

function createPlaneNode(latestValues: ResolvedValues): PlaneNode {
    PlaneProjectionNode ||= class extends (
        createProjectionNode<LayoutPlaneSource>({
            defaultParent: documentRoot,
            measureScroll: () => ({ x: 0, y: 0 }),
            checkIsScrollRoot: () => false,
        })
    ) {
        declare isPresent?: boolean

        /**
         * A plane is laid out where the source says, and always animates
         * with quad projection. A snapshot records where it's drawn, which
         * mid-animation isn't where it's laid out.
         */
        measure(isSnapshot = true): Measurements {
            const box = createBox()
            const quad: QuadMeasurements = {
                rect: createBox(),
                env: identity(createMat3()),
                frame: identity(createMat3()),
                perspective: new Float64Array(3),
                isQuadSpace: true,
            }

            if (this.instance!.measure(measured)) {
                toPage(measured, this)
                naturalRect(quad.rect, measured)

                if (isSnapshot) {
                    const visual = (quad.visual = copyQuad(
                        createQuad(),
                        measured
                    ))
                    const { quad: projection } = this
                    if (projection?.active) {
                        transformBoxToQuad(
                            visual,
                            projection.output,
                            projection.rect
                        )
                    }
                    quadBounds(box, visual)
                } else {
                    quadBounds(box, measured)
                }
            }

            return {
                animationId: this.root.animationId,
                measuredBox: box,
                layoutBox: { x: { ...box.x }, y: { ...box.y } },
                latestValues: {},
                source: this.id,
                quad,
            }
        }

        measureTransform(rect: Box, out: Mat3) {
            if (!this.instance?.track(measured)) return false
            toPage(measured, this)
            return boxToQuad(out, rect, measured)
        }

        /**
         * Unmounting snapshots a node so whatever replaces it can animate
         * from it. A plane hidden outside an update just disappears, and
         * mustn't start an update that nothing will finish.
         */
        willUpdate(shouldNotifyListeners?: boolean) {
            if (this.isPresent !== false || this.root.isUpdating) {
                super.willUpdate(shouldNotifyListeners)
            }
        }
    }

    return new PlaneProjectionNode(latestValues)
}

class PlaneVisualElement extends VisualElement<LayoutPlaneSource, {}> {
    type = "plane"

    sortInstanceNodePosition() {
        return 0
    }

    measureInstanceViewportBox(source: LayoutPlaneSource) {
        const box = createBox()
        source.measure(measured) && quadBounds(box, measured)
        return box
    }

    getBaseTargetFromProps() {
        return undefined
    }

    readValueFromInstance() {
        return undefined
    }

    removeValueFromRenderState() {}

    build() {}

    /**
     * Draw before `frame.render`, where scenes are rendered, but after the
     * projection is calculated.
     */
    scheduleRender = () => {
        frame.preRender(this.render, false, true)
    }

    renderInstance(
        source: LayoutPlaneSource,
        _renderState: {},
        _style: unknown,
        node: PlaneNode
    ) {
        const lead = node.getLead()
        const isLead = lead === node
        const values = lead.animationValues || lead.latestValues
        const opacity = Number(
            isLead
                ? values.opacity ?? 1
                : node.preserveOpacity
                ? 1
                : values.opacityExit ?? (lead.animationValues ? 1 : 0)
        )

        const { quad } = node
        const isProjecting = Boolean(quad?.active && lead.quad?.active)
        const visible =
            node.isVisible && opacity > 0 && (isLead || isProjecting)

        if (!isProjecting) {
            source.render(undefined, opacity, visible)
            return
        }

        const { x, y } = quad!.rect
        rectToRect(unit, 0, 0, 1, 1, x.min, y.min, x.max - x.min, y.max - y.min)
        multiply(drawn, quad!.output, unit)

        const scroll = node.root!.scroll?.offset
        scroll && preTranslate(drawn, drawn, -scroll.x, -scroll.y)

        source.render(drawn, opacity, visible)

        /**
         * Keep drawing until the animation ends, then once more where the
         * plane is laid out.
         */
        frame.preRender(this.render)
    }
}

/**
 * Let a plane drawn outside the DOM, like a mesh in a WebGL scene, take
 * part in layout animations. It shares a layoutId with elements, or other
 * planes, and animates between them with animateLayout():
 *
 * ```ts
 * const plane = createLayoutPlane(source, { layoutId: "card", visible: false })
 *
 * animateLayout(() => {
 *     card.remove()
 *     plane.show()
 * })
 * ```
 */
export function createLayoutPlane(
    source: LayoutPlaneSource,
    { visible = true, transition, ...options }: LayoutPlaneOptions
): LayoutPlane {
    /**
     * Planes always animate with quad projection.
     */
    layoutEngine || setLayoutEngine(quadLayout)

    let node: PlaneNode | undefined
    let leaving: PlaneNode | undefined

    const remove = (target: PlaneNode) => {
        if (leaving === target) leaving = undefined
        if (!target.instance) return
        const stack = target.getStack()
        layoutPlanes.delete(target)
        target.options.visualElement!.unmount()
        source.render(undefined, 0, false)
        stack?.lead?.resumeFrom === target && forget(stack.lead)
    }

    const plane: LayoutPlane = {
        show() {
            leaving && remove(leaving)
            if (node) return

            const visualElement = new PlaneVisualElement({
                props: { transition },
                presenceContext: null,
                visualState: { latestValues: {}, renderState: {} },
            })
            node = createPlaneNode(visualElement.latestValues)
            visualElement.projection = node
            node.setOptions({ ...options, layout: true, visualElement })
            node.mount(source)
            forget(node)
            layoutPlanes.add(node)
            visualElement.scheduleRender()
        },

        hide() {
            if (!node) return
            const target = node
            node = undefined
            target.isPresent = false

            /**
             * During an update, stay until whatever takes over has
             * animated from here.
             */
            if (target.root!.isUpdating) {
                leaving = target
                target.setOptions({
                    crossfade: target.options.crossfade,
                    onExitComplete: () => remove(target),
                })
            } else {
                remove(target)
            }
        },
    }

    visible ? plane.show() : source.render(undefined, 0, false)

    return plane
}
