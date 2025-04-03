import { NativeAnimation, NativeAnimationOptions } from "./NativeAnimation"
import { replaceStringEasing } from "./waapi/utils/unsupported-easing"

export class NativeAnimationExtended extends NativeAnimation {
    constructor(options: NativeAnimationOptions) {
        /**
         * The base NativeAnimation function only supports a subset
         * of Motion easings, and WAAPI also only supports some
         * easing functions via string/cubic-bezier definitions.
         *
         * This function replaces those unsupported easing functions
         * with a JS easing function. This will later get compiled
         * to a linear() easing function.
         */
        replaceStringEasing(options.transition)

        /**
         * Ensure we replace the transition type with a generator function
         * before passing to WAAPI.
         *
         * TODO: Does this have a better home? It could be shared with
         * JSAnimation.
         */
        replaceTransitionType(options.transition)

        super(options)
    }

    commitStyles() {
        // TODO: set motion value
    }

    // TODO: Sample animation when stopping
    //    /**
    //      * WAAPI doesn't natively have any interruption capabilities.
    //      *
    //      * Rather than read commited styles back out of the DOM, we can
    //      * create a renderless JS animation and sample it twice to calculate
    //      * its current value, "previous" value, and therefore allow
    //      * Motion to calculate velocity for any subsequent animation.
    //      */
    //    if (this.time) {
    //     const { motionValue, onUpdate, onComplete, element, ...options } =
    //         this.options

    //     const sampleAnimation = new MainThreadAnimation({
    //         ...options,
    //         keyframes,
    //         duration,
    //         type,
    //         ease,
    //         times,
    //         isGenerator: true,
    //     })

    //     const sampleTime = secondsToMilliseconds(this.time)

    //     motionValue.setWithVelocity(
    //         sampleAnimation.sample(sampleTime - sampleDelta).value,
    //         sampleAnimation.sample(sampleTime).value,
    //         sampleDelta
    //     )
    // }
}

// TODO: Pregenerated keyframes. Do we still need this?
// Or we could leave this to linear() easing, leave commitStyles to
// samepl

/**
 * If this animation needs pre-generated keyframes then generate.
 */
//  if (requiresPregeneratedKeyframes(this.options)) {
//   const { onComplete, onUpdate, motionValue, element, ...options } =
//       this.options
//   const pregeneratedAnimation = pregenerateKeyframes(
//       keyframes,
//       options
//   )

//   keyframes = pregeneratedAnimation.keyframes

//   // If this is a very short animation, ensure we have
//   // at least two keyframes to animate between as older browsers
//   // can't animate between a single keyframe.
//   if (keyframes.length === 1) {
//       keyframes[1] = keyframes[0]
//   }

//   duration = pregeneratedAnimation.duration
//   times = pregeneratedAnimation.times
//   ease = pregeneratedAnimation.ease
//   type = "keyframes"
// }

// /**
//  * 10ms is chosen here as it strikes a balance between smooth
//  * results (more than one keyframe per frame at 60fps) and
//  * keyframe quantity.
//  */
// const sampleDelta = 10 //ms

// /**
//  * Implement a practical max duration for keyframe generation
//  * to prevent infinite loops
//  */
// const maxDuration = 20_000

// /**
//  * Check if an animation can run natively via WAAPI or requires pregenerated keyframes.
//  * WAAPI doesn't support spring or function easings so we run these as JS animation before
//  * handing off.
//  */
// function requiresPregeneratedKeyframes<T extends string | number>(
//     options: ValueAnimationOptions<T>
// ) {
//     return (
//         isGenerator(options.type) ||
//         options.type === "spring" ||
//         !isWaapiSupportedEasing(options.ease)
//     )
// }

// function pregenerateKeyframes<T extends string | number>(
//     keyframes: ResolvedKeyframes<T>,
//     options: ValueAnimationOptions<T>
// ) {
//     /**
//      * Create a main-thread animation to pregenerate keyframes.
//      * We sample this at regular intervals to generate keyframes that we then
//      * linearly interpolate between.
//      */
//     const sampleAnimation = new MainThreadAnimation({
//         ...options,
//         keyframes,
//         repeat: 0,
//         delay: 0,
//         isGenerator: true,
//     })

//     let state = { done: false, value: keyframes[0] }
//     const pregeneratedKeyframes: T[] = []

//     /**
//      * Bail after 20 seconds of pre-generated keyframes as it's likely
//      * we're heading for an infinite loop.
//      */
//     let t = 0
//     while (!state.done && t < maxDuration) {
//         state = sampleAnimation.sample(t)
//         pregeneratedKeyframes.push(state.value)
//         t += sampleDelta
//     }

//     return {
//         times: undefined,
//         keyframes: pregeneratedKeyframes,
//         duration: t - sampleDelta,
//         ease: "linear" as EasingDefinition,
//     }
// }
