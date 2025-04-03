import { clamp } from "../clamp"
import type { EasingFunction } from "./types"

/*
  Create stepped version of 0-1 progress

  @param [int]: Number of steps
  @param [number]: Current value
  @return [number]: Stepped value
*/
export type Direction = "start" | "end"

export function steps(
    numSteps: number,
    direction: Direction = "end"
): EasingFunction {
    return (progress: number) => {
        progress =
            direction === "end"
                ? Math.min(progress, 0.999)
                : Math.max(progress, 0.001)
        const expanded = progress * numSteps
        const rounded =
            direction === "end" ? Math.floor(expanded) : Math.ceil(expanded)

        return clamp(0, 1, rounded / numSteps)
    }
}
