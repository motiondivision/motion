import { buildTransformFrom } from "../../../effects/style/transform"
import { transformPropOrder } from "../../utils/keys-transform"
import { ResolvedValues } from "../../types"
import { HTMLRenderState } from "../types"
import type { MotionNodeOptions } from "../../../node/types"

/**
 * Build a CSS transform style from individual x/y/scale etc properties.
 *
 * This outputs with a default order of transforms/scales/rotations, this can be customised by
 * providing a transformTemplate function.
 */
export function buildTransform(
    latestValues: ResolvedValues,
    transform: HTMLRenderState["transform"],
    transformTemplate?: MotionNodeOptions["transformTemplate"]
) {
    return (
        buildTransformFrom(
            transformPropOrder,
            (key) => latestValues[key],
            transformTemplate &&
                ((typed, generated) =>
                    transformTemplate(
                        Object.assign(transform, typed) as any,
                        generated
                    ))
        ) || "none"
    )
}
