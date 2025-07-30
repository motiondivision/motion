import { ValueAnimationOptions } from "../types"

export function makeAnimationInstant(
    options: Partial<{
        duration: ValueAnimationOptions["duration"]
        type: ValueAnimationOptions["type"]
    }>
): void {
    options.duration = 0
    options.type === "keyframes"
}
