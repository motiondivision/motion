import { Axis, AxisDelta, Box, Delta } from "motion-utils"

export const createAxisDelta = (): AxisDelta => ({
    translate: 0,
    scale: 1,
    origin: 0,
    originPoint: 0,
})

export const createDelta = (): Delta => ({
    x: createAxisDelta(),
    y: createAxisDelta(),
})

export const createAxis = (): Axis => ({ min: 0, max: 0 })

export const createBox = (): Box => ({
    x: createAxis(),
    y: createAxis(),
})
