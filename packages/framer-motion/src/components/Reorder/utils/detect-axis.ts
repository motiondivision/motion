import { Axis, Box } from "motion-utils"
import { ReorderAxis } from "../types"

const isSeparated = (a: Axis, b: Axis) => a.max <= b.min || b.max <= a.min

export function detectAxis(layouts: Box[]): ReorderAxis {
    let x = false
    let y = false

    for (let i = 0; i < layouts.length; i++) {
        for (let j = i + 1; j < layouts.length; j++) {
            x ||= isSeparated(layouts[i].x, layouts[j].x)
            y ||= isSeparated(layouts[i].y, layouts[j].y)

            if (x && y) return "xy"
        }
    }

    return x ? "x" : "y"
}
