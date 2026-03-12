import type { Arc } from "../types"

export function bezierPoint(
    t: number,
    origin: number,
    control: number,
    target: number
): number {
    return (
        Math.pow(1 - t, 2) * origin +
        2 * (1 - t) * t * control +
        Math.pow(t, 2) * target
    )
}

export function computeArcControlPoint(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    amplitude: number,
    peak: number
): { x: number; y: number } {
    const deltaX = toX - fromX
    const deltaY = toY - fromY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    if (distance > 0) {
        const normalPerpX = -deltaY / distance
        const normalPerpY = deltaX / distance
        const desiredHeight = amplitude * distance

        return {
            x: fromX + deltaX * peak + normalPerpX * desiredHeight,
            y: fromY + deltaY * peak + normalPerpY * desiredHeight,
        }
    }

    return { x: fromX, y: fromY }
}

export function resolveArcAmplitude(
    arc: Arc,
    deltaX: number,
    deltaY: number
): number {
    let amplitude = arc.amplitude
    const { direction } = arc

    if (direction === "cw") {
        amplitude *= -1
    } else if (!direction) {
        const dominantDelta =
            Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY
        if (dominantDelta < 0) amplitude *= -1
    }
    // "ccw": no change

    return amplitude
}
