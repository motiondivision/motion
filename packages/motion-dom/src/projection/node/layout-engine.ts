import type { Box } from "motion-utils"
import type { TransformTemplate } from "../../node/types"
import type { ResolvedValues } from "../../render/types"
import type { IProjectionNode, Measurements, QuadMeasurements } from "./types"

/**
 * An engine for the layout animations boxes can't describe: elements drawn
 * inside rotated, skewed or 3D transforms Motion doesn't control, elements
 * moving between such spaces, and planes drawn outside the DOM.
 *
 * Without one, projection nodes animate every element as an axis-aligned
 * box, exactly as before.
 */
export interface LayoutEngine {
    /**
     * Read the space a node is drawn in, before its boxes are measured, and
     * neutralise the transforms there that Motion doesn't control, so its
     * boxes measure in the space inside them. Undefined, the common case,
     * if nothing transforms it.
     */
    readSpace(node: IProjectionNode, pass: number): QuadMeasurements | undefined

    /**
     * Restore what `readSpace` neutralised, and finish a node's
     * measurements, once its boxes are measured.
     */
    measureQuad(
        node: IProjectionNode,
        quad: QuadMeasurements | undefined,
        isSnapshot: boolean,
        layoutBox: Box
    ): QuadMeasurements | undefined

    /**
     * Decide whether a starting layout animation needs this engine, and if
     * so start it. Returns false to leave it to the box engine.
     */
    startAnimation(
        node: IProjectionNode,
        snapshot: Measurements | undefined,
        isShared: boolean
    ): boolean

    /**
     * Per frame, for nodes whose lead this engine is animating: project a
     * lead, then (once every lead has been) its followers.
     */
    calcLead(node: IProjectionNode, lead: IProjectionNode): void
    calcFollow(node: IProjectionNode): void

    /**
     * Render the transform of a node this engine projects, and return it.
     * Also sizes `node.quad.correction`, the stand-in its scale correctors
     * read the projected size from.
     */
    applyStyles(
        node: IProjectionNode,
        targetStyle: any,
        valuesToRender: ResolvedValues,
        transformTemplate: TransformTemplate | undefined
    ): string

    stop(node: IProjectionNode): void
}

export let layoutEngine: LayoutEngine | undefined

/**
 * Choose the engine layout animations use beyond boxes, or pass nothing to
 * animate every element as a box.
 */
export function setLayoutEngine(engine?: LayoutEngine) {
    layoutEngine = engine
}
