import { motionValue, MotionValue } from "motion-dom"

/**
 * @public
 */
export interface ScrollMotionValues {
    scrollX: MotionValue<number>
    scrollY: MotionValue<number>
    scrollXProgress: MotionValue<number>
    scrollYProgress: MotionValue<number>
}

export interface ScrollOffsets {
    xOffset: number
    yOffset: number
    xMaxOffset: number
    yMaxOffset: number
}

export type GetScrollOffsets = () => ScrollOffsets

export function createScrollMotionValues(): ScrollMotionValues {
    return {
        scrollX: motionValue(0),
        scrollY: motionValue(0),
        scrollXProgress: motionValue(0),
        scrollYProgress: motionValue(0),
    }
}

function setProgress(offset: number, maxOffset: number, value: MotionValue) {
    value.set(!offset || !maxOffset ? 0 : offset / maxOffset)
}

export function createScrollUpdater(
    values: ScrollMotionValues,
    getOffsets: GetScrollOffsets
) {
    const update = () => {
        const { xOffset, yOffset, xMaxOffset, yMaxOffset } = getOffsets()
        // Set absolute positions
        values.scrollX.set(xOffset)
        values.scrollY.set(yOffset)
        // Set 0-1 progress
        setProgress(xOffset, xMaxOffset, values.scrollXProgress)
        setProgress(yOffset, yMaxOffset, values.scrollYProgress)
    }

    update()

    return update
}
