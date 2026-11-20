import type { ValueAnimationOptions } from "../../types"

/**
 * The transform code that composes an element's transforms and plays them
 * on WAAPI. The animation engine reaches it through this object, so an
 * engine that only animates values and plain objects doesn't bundle it.
 * Code that animates elements calls enableAcceleration().
 */
export interface Acceleration {
    canGroupValue: (
        options: ValueAnimationOptions<any>,
        composes?: boolean
    ) => boolean | undefined
    canAccelerateTransform: (options: ValueAnimationOptions<any>) => boolean
    joinGroup: (track: any) => any
}

export const acceleration: { current?: Acceleration } = {}

export const round = (value: number) => Math.round(value * 10000) / 10000
