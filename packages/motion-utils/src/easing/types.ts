export type EasingFunction = (v: number) => number

export type EasingModifier = (easing: EasingFunction) => EasingFunction

export type BezierDefinition = readonly [number, number, number, number]

export type EasingDefinition =
    | BezierDefinition
    | "linear"
    | "easeIn"
    | "easeOut"
    | "easeInOut"
    | "circIn"
    | "circOut"
    | "circInOut"
    | "backIn"
    | "backOut"
    | "backInOut"
    | "anticipate"

/**
 * The easing function to use. Set as one of:
 *
 * - The name of an in-built easing function.
 * - An array of four numbers to define a cubic bezier curve.
 * - An easing function, that accepts and returns a progress value between `0` and `1`.
 *
 * @public
 */
export type Easing = EasingDefinition | EasingFunction
