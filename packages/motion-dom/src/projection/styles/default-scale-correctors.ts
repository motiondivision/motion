import { cornerRadiusProps } from "../../utils/border-radius"
import { correctBorderRadius } from "./scale-border-radius"
import { correctBoxShadow } from "./scale-box-shadow"
import type { ScaleCorrectorMap } from "./types"

export const defaultScaleCorrectors: ScaleCorrectorMap = {
    borderRadius: {
        ...correctBorderRadius,
        applyTo: [...cornerRadiusProps],
    },
    borderTopLeftRadius: correctBorderRadius,
    borderTopRightRadius: correctBorderRadius,
    borderBottomLeftRadius: correctBorderRadius,
    borderBottomRightRadius: correctBorderRadius,
    boxShadow: correctBoxShadow,
}
