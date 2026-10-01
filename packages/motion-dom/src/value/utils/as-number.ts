import type { AnyResolvedKeyframe } from "../../animation/types"

export const asNumber = (v: AnyResolvedKeyframe) =>
    typeof v === "number" ? v : parseFloat(v)
