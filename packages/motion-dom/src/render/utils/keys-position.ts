import { transformPropOrder } from "./keys-transform"

export const positionalKeys = /* @__PURE__ */ (() =>
    new Set([
        "width",
        "height",
        "top",
        "left",
        "right",
        "bottom",
        ...transformPropOrder,
    ]))()
