import { memoSupports } from "./memo"

export const supportsLinearEasing = /*@__PURE__*/ memoSupports(() => {
    try {
        document
            .createElement("div")
            .animate({ opacity: 0 }, { easing: "linear(0, 1)" })
    } catch (e) {
        return false
    }
    return true
}, "linearEasing")