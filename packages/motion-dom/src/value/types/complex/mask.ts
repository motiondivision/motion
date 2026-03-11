import { complex } from "."
import { AnyResolvedKeyframe } from "../../../animation/types"

export const mask = {
    ...complex,
    getAnimatableNone: (v: AnyResolvedKeyframe) => {
        const parsed = complex.parse(v)
        const transformer = complex.createTransformer(v)
        return transformer(
            parsed.map((v) =>
                typeof v === "number" ? 0 : typeof v === "object" ? { ...v, alpha: 1 } : v
            )
        )
    },
}
