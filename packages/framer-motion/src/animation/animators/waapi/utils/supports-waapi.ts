import { memo } from "motion-utils"

export const supportsWaapi = /*@__PURE__*/ memo(() =>
    Object.hasOwnProperty.call(Element.prototype, "animate")
)
