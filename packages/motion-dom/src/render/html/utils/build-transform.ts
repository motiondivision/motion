import { buildTransform as buildTransformString } from "../../../effects/style/transform"
import type { MotionNodeOptions } from "../../../node/types"
import { ResolvedValues } from "../../types"
import { HTMLRenderState } from "../types"

/**
 * Build a CSS transform style from individual x/y/scale etc properties,
 * optionally passing the generated transform through a user-provided
 * transformTemplate.
 */
export function buildTransform(
    latestValues: ResolvedValues,
    transform: HTMLRenderState["transform"],
    transformTemplate?: MotionNodeOptions["transformTemplate"]
) {
    const transformString = buildTransformString(
        latestValues,
        transformTemplate ? transform : undefined
    )

    return transformTemplate
        ? transformTemplate(
              transform,
              transformString === "none" ? "" : transformString
          )
        : transformString
}
