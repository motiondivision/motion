import { rootProjectionNode } from "motion-dom"

export function useInstantLayoutTransition(): (
    cb?: (() => void) | undefined
) => void {
    return startTransition
}

function startTransition(callback?: () => void) {
    if (!rootProjectionNode.current) return
    rootProjectionNode.current.isUpdating = false
    rootProjectionNode.current.blockUpdate()
    callback && callback()
}
