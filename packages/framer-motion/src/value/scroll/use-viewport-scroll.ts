import { warnOnce } from "motion-utils"
import { useScroll } from "../use-scroll"

/**
 * @deprecated useViewportScroll is deprecated. Convert to useScroll()
 */
export function useViewportScroll() {
    if (process.env.NODE_ENV !== "production") {
        warnOnce(
            false,
            "useViewportScroll is deprecated. Convert to useScroll()."
        )
    }
    return useScroll()
}
