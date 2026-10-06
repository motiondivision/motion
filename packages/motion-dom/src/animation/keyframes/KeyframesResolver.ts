import { isNumericalString, isZeroValueString } from "motion-utils"
import { frame } from "../../frameloop"
import { MotionValue } from "../../value"
import { complex } from "../../value/types/complex"
import { getAnimatableNone } from "../../value/types/utils/animatable-none"
import { AnyResolvedKeyframe } from "../types"
import { WithRender } from "./types"
import { fillWildcards } from "./utils/fill-wildcards"
import {
    boxDependentValues,
    removeNonTranslationalTransform,
} from "./utils/unit-conversion"

export type UnresolvedKeyframes<T extends AnyResolvedKeyframe> = Array<T | null>

export type ResolvedKeyframes<T extends AnyResolvedKeyframe> = Array<T>

const toResolve = new Set<KeyframeResolver>()
let isScheduled = false
let anyNeedsMeasurement = false
let isForced = false

function measureAllKeyframes() {
    if (anyNeedsMeasurement) {
        const resolversToMeasure: KeyframeResolver[] = []
        const elementsToMeasure = new Set<WithRender>()
        const elementsToUntransform = new Set<WithRender>()

        toResolve.forEach((resolver) => {
            if (!resolver.needsMeasurement) return

            resolversToMeasure.push(resolver)
            elementsToMeasure.add(resolver.element!)

            if (boxDependentValues.has(resolver.name!)) {
                elementsToUntransform.add(resolver.element!)
            }
        })

        const transformsToRestore = new Map<
            WithRender,
            [string, AnyResolvedKeyframe][]
        >()

        /**
         * Write pass
         * Values measured from the bounding box need bounding box-changing
         * transforms removed first. Values read from computed style don't.
         */
        elementsToUntransform.forEach((element: WithRender) => {
            const removedTransforms = removeNonTranslationalTransform(
                element as any
            )

            if (!removedTransforms.length) return

            transformsToRestore.set(element, removedTransforms)

            element.render()
        })

        // Read
        resolversToMeasure.forEach((resolver) => resolver.measureInitialState())

        // Write
        elementsToMeasure.forEach((element: WithRender) => {
            element.render()

            const restore = transformsToRestore.get(element)
            if (restore) {
                restore.forEach(([key, value]) => {
                    element.getValue(key)?.set(value)
                })
            }
        })

        // Read
        resolversToMeasure.forEach((resolver) => resolver.measureEndState())

        // Write
        resolversToMeasure.forEach((resolver) => {
            if (resolver.suspendedScrollY !== undefined) {
                window.scrollTo(0, resolver.suspendedScrollY)
            }
        })
    }

    anyNeedsMeasurement = false
    isScheduled = false

    toResolve.forEach((resolver) => resolver.complete(isForced))
    toResolve.clear()
}

function readAllKeyframes() {
    toResolve.forEach((resolver) => {
        resolver.readKeyframes()

        if (resolver.needsMeasurement) {
            anyNeedsMeasurement = true
        }
    })
}

export function flushKeyframeResolvers() {
    isForced = true
    readAllKeyframes()
    measureAllKeyframes()
    isForced = false
}

/**
 * Normalise a value read from the subject into an animation origin: a
 * number read as a string ("0", "200") becomes a number, and a value
 * that isn't animatable (e.g. "none") but whose target is becomes an
 * animatable zero in the shape of the target.
 */
function readOrigin(
    value: AnyResolvedKeyframe | null | undefined,
    name: string,
    target: AnyResolvedKeyframe | null
) {
    if (typeof value === "string") {
        if (isNumericalString(value) || isZeroValueString(value)) {
            return parseFloat(value)
        } else if (!complex.test(value) && complex.test(target)) {
            return getAnimatableNone(name, target as string)
        }
    }

    return value ?? undefined
}

export type OnKeyframesResolved<T extends AnyResolvedKeyframe> = (
    resolvedKeyframes: ResolvedKeyframes<T>,
    finalKeyframe: T,
    forced: boolean
) => void

export class KeyframeResolver<T extends AnyResolvedKeyframe = any> {
    name?: string
    element?: WithRender
    finalKeyframe?: T
    suspendedScrollY?: number

    protected unresolvedKeyframes: UnresolvedKeyframes<AnyResolvedKeyframe>

    protected motionValue?: MotionValue<T>
    private onComplete: OnKeyframesResolved<T>

    state: "pending" | "scheduled" | "complete" = "pending"

    /**
     * Track whether this resolver is async. If it is, it'll be added to the
     * resolver queue and flushed in the next frame. Resolvers that aren't going
     * to trigger read/write thrashing don't need to be async.
     */
    private isAsync = false

    /**
     * Track whether this resolver needs to perform a measurement
     * to resolve its keyframes.
     */
    needsMeasurement = false

    constructor(
        unresolvedKeyframes: UnresolvedKeyframes<AnyResolvedKeyframe>,
        onComplete: OnKeyframesResolved<T>,
        name?: string,
        motionValue?: MotionValue<T>,
        element?: WithRender,
        isAsync = false
    ) {
        this.unresolvedKeyframes = [...unresolvedKeyframes]
        this.onComplete = onComplete
        this.name = name
        this.motionValue = motionValue
        this.element = element
        this.isAsync = isAsync
    }

    scheduleResolve() {
        this.state = "scheduled"

        if (this.isAsync) {
            toResolve.add(this)

            if (!isScheduled) {
                isScheduled = true
                frame.read(readAllKeyframes)
                frame.resolveKeyframes(measureAllKeyframes)
            }
        } else {
            this.readKeyframes()
            this.complete()
        }
    }

    readKeyframes() {
        const { unresolvedKeyframes, name, element, motionValue } = this

        // If initial keyframe is null we need to read it from the DOM
        if (unresolvedKeyframes[0] === null) {
            const currentValue = motionValue?.get()

            // TODO: This doesn't work if the final keyframe is a wildcard
            const finalKeyframe =
                unresolvedKeyframes[unresolvedKeyframes.length - 1]

            if (currentValue !== undefined) {
                unresolvedKeyframes[0] = currentValue
            } else if (element && name) {
                const valueAsRead = readOrigin(
                    element.readValue(name, finalKeyframe),
                    name,
                    finalKeyframe
                )

                if (valueAsRead !== undefined) {
                    unresolvedKeyframes[0] = valueAsRead
                }
            }

            if (unresolvedKeyframes[0] === undefined) {
                unresolvedKeyframes[0] = finalKeyframe
            }

            if (motionValue && currentValue === undefined) {
                motionValue.set(unresolvedKeyframes[0] as T)
            }
        }

        fillWildcards(unresolvedKeyframes)
    }

    setFinalKeyframe() {}
    measureInitialState() {}
    renderEndStyles() {}
    measureEndState() {}

    complete(isForcedComplete = false) {
        this.state = "complete"

        this.onComplete(
            this.unresolvedKeyframes as ResolvedKeyframes<T>,
            this.finalKeyframe as T,
            isForcedComplete
        )

        toResolve.delete(this)
    }

    cancel() {
        if (this.state === "scheduled") {
            toResolve.delete(this)
            this.state = "pending"
        }
    }

    resume() {
        if (this.state === "pending") this.scheduleResolve()
    }
}
