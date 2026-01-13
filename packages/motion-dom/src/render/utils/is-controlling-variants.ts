import type { MotionNodeOptions } from "../../node/types"
import { isAnimationControls } from "./is-animation-controls"
import { isVariantLabel } from "./is-variant-label"
import { variantProps } from "./variant-props"

export function isControllingVariants(props: MotionNodeOptions) {
    return (
        isAnimationControls(props.animate) ||
        variantProps.some((name) =>
            isVariantLabel(props[name as keyof typeof props])
        )
    )
}

export function isVariantNode(props: MotionNodeOptions) {
    return Boolean(isControllingVariants(props) || props.variants)
}
