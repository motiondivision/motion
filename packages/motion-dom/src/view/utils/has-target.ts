import { Target, ViewTransitionTarget } from "../types"

export function hasTarget(
    target: Target,
    targets: Map<Target, ViewTransitionTarget>
) {
    return targets.has(target) && Object.keys(targets.get(target)!).length > 0
}
