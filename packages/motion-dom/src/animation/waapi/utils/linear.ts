import { EasingFunction } from "motion-utils"

export const generateLinearEasing = (
    easing: EasingFunction,
    duration: number, // as milliseconds
    resolution: number = 10 // as milliseconds
): string => {
    let points = ""
    const numPoints = Math.max(Math.round(duration / resolution), 2)

    for (let i = 0; i < numPoints; i++) {
        points += easing(i / (numPoints - 1)) + ", "
    }

    return `linear(${points.substring(0, points.length - 2)})`
}
