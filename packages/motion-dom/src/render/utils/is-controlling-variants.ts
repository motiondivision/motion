import type { MotionNodeOptions } from "../../node/types"
import { isAnimationControls } from "./is-animation-controls"
import { isVariantLabel } from "./is-variant-label"
import { variantProps } from "./variant-props"

export function isControllingVariants(props: MotionNodeOptions) {
    if (isAnimationControls(props.animate)) return true

    for (let i = 0; i < variantProps.length; i++) {
        if (isVariantLabel(props[variantProps[i] as keyof typeof props])) {
            return true
        }
    }

    return false
}

export function isVariantNode(props: MotionNodeOptions) {
    return Boolean(isControllingVariants(props) || props.variants)
}
