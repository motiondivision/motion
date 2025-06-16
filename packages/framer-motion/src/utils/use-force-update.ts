import { frame } from "motion-dom"
import { useCallback, useState } from "react"
import { useIsMounted } from "./use-is-mounted"

export function useForceUpdate(): [VoidFunction, number] {
    const isMounted = useIsMounted()
    const [forcedRenderCount, setForcedRenderCount] = useState(0)

    const forceRender = useCallback(() => {
        isMounted.current && setForcedRenderCount(forcedRenderCount + 1)
    }, [forcedRenderCount])

    /**
     * Defer this to the end of the next animation frame in case there are multiple
     * synchronous calls.
     */
    const deferredForceRender = useCallback(
        () => frame.postRender(forceRender),
        [forceRender]
    )

    return [deferredForceRender, forcedRenderCount]
}
