import { warnOnce } from "motion-utils"
import { RefObject } from "react"
import { useScroll } from "../use-scroll"

/**
 * @deprecated useElementScroll is deprecated. Convert to useScroll({ container: ref })
 */
export function useElementScroll(ref: RefObject<HTMLElement | null>) {
    if (process.env.NODE_ENV === "development") {
        warnOnce(
            false,
            "useElementScroll is deprecated. Convert to useScroll({ container: ref })."
        )
    }

    return useScroll({ container: ref })
}
