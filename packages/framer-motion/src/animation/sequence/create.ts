import {
    AnimationScope,
    createGeneratorEasing,
    DOMKeyframesDefinition,
    AnimationOptions as DynamicAnimationOptions,
    GeneratorFactory,
    isGenerator,
    Transition,
    UnresolvedValueKeyframe,
} from "motion-dom"
import { invariant, progress, secondsToMilliseconds } from "motion-utils"
import { Easing } from "../../easing/types"
import { getEasingForSegment } from "../../easing/utils/get-easing-for-segment"
import { defaultOffset } from "../../utils/offsets/default"
import { fillOffset } from "../../utils/offsets/fill"
import type { MotionValue } from "../../value"
import { isMotionValue } from "../../value/utils/is-motion-value"
import { resolveSubjects } from "../animate/resolve-subjects"
import {
    AnimationSequence,
    At,
    ResolvedAnimationDefinitions,
    SequenceMap,
    SequenceOptions,
    ValueSequence,
} from "./types"
import { calculateRepeatDuration } from "./utils/calc-repeat-duration"
import { calcNextTime } from "./utils/calc-time"
import { addKeyframes } from "./utils/edit"
import { normalizeTimes } from "./utils/normalize-times"
import { compareByTime } from "./utils/sort"

const defaultSegmentEasing = "easeInOut"

const MAX_REPEAT = 20

export function createAnimationsFromSequence(
    sequence: AnimationSequence,
    { defaultTransition = {}, ...sequenceTransition }: SequenceOptions = {},
    scope?: AnimationScope,
    generators?: { [key: string]: GeneratorFactory }
): ResolvedAnimationDefinitions {
    const defaultDuration = defaultTransition.duration || 0.3
    const animationDefinitions: ResolvedAnimationDefinitions = new Map()
    const sequences = new Map<Element | MotionValue, SequenceMap>()
    const elementCache = {}
    const timeLabels = new Map<string, number>()

    let prevTime = 0
    let currentTime = 0
    let totalDuration = 0

    /**
     * Build the timeline by mapping over the sequence array and converting
     * the definitions into keyframes and offsets with absolute time values.
     * These will later get converted into relative offsets in a second pass.
     */
    for (let i = 0; i < sequence.length; i++) {
        const segment = sequence[i]

        /**
         * If this is a timeline label, mark it and skip the rest of this iteration.
         */
        if (typeof segment === "string") {
            timeLabels.set(segment, currentTime)
            continue
        } else if (!Array.isArray(segment)) {
            timeLabels.set(
                segment.name,
                calcNextTime(currentTime, segment.at, prevTime, timeLabels)
            )
            continue
        }

        let [subject, keyframes, transition = {}] = segment

        /**
         * If a relative or absolute time value has been specified we need to resolve
         * it in relation to the currentTime.
         */
        if (transition.at !== undefined) {
            currentTime = calcNextTime(
                currentTime,
                transition.at,
                prevTime,
                timeLabels
            )
        }

        /**
         * Keep track of the maximum duration in this definition. This will be
         * applied to currentTime once the definition has been parsed.
         */
        let maxDuration = 0

        const resolveValueSequence = (
            valueKeyframes: UnresolvedValueKeyframe | UnresolvedValueKeyframe[],
            valueTransition: Transition | DynamicAnimationOptions,
            valueSequence: ValueSequence,
            elementIndex = 0,
            numSubjects = 0
        ) => {
            const valueKeyframesAsList = keyframesAsList(valueKeyframes)
            const {
                delay = 0,
                times = defaultOffset(valueKeyframesAsList),
                type = "keyframes",
                repeat,
                repeatType,
                repeatDelay = 0,
                ...remainingTransition
            } = valueTransition
            let { ease = defaultTransition.ease || "easeOut", duration } =
                valueTransition

            /**
             * Resolve stagger() if defined.
             */
            const calculatedDelay =
                typeof delay === "function"
                    ? delay(elementIndex, numSubjects)
                    : delay

            /**
             * If this animation should and can use a spring, generate a spring easing function.
             */
            const numKeyframes = valueKeyframesAsList.length
            const createGenerator = isGenerator(type)
                ? type
                : generators?.[type]

            if (numKeyframes <= 2 && createGenerator) {
                /**
                 * As we're creating an easing function from a spring,
                 * ideally we want to generate it using the real distance
                 * between the two keyframes. However this isn't always
                 * possible - in these situations we use 0-100.
                 */
                let absoluteDelta = 100
                if (
                    numKeyframes === 2 &&
                    isNumberKeyframesArray(valueKeyframesAsList)
                ) {
                    const delta =
                        valueKeyframesAsList[1] - valueKeyframesAsList[0]
                    absoluteDelta = Math.abs(delta)
                }

                const springTransition = { ...remainingTransition }
                if (duration !== undefined) {
                    springTransition.duration = secondsToMilliseconds(duration)
                }

                const springEasing = createGeneratorEasing(
                    springTransition,
                    absoluteDelta,
                    createGenerator
                )

                ease = springEasing.ease
                duration = springEasing.duration
            }

            duration ??= defaultDuration

            const startTime = currentTime + calculatedDelay

            /**
             * If there's only one time offset of 0, fill in a second with length 1
             */
            if (times.length === 1 && times[0] === 0) {
                times[1] = 1
            }

            /**
             * Fill out if offset if fewer offsets than keyframes
             */
            const remainder = times.length - valueKeyframesAsList.length
            remainder > 0 && fillOffset(times, remainder)

            /**
             * If only one value has been set, ie [1], push a null to the start of
             * the keyframe array. This will let us mark a keyframe at this point
             * that will later be hydrated with the previous value.
             */
            valueKeyframesAsList.length === 1 &&
                valueKeyframesAsList.unshift(null)

            /**
             * Handle repeat options
             */
            if (repeat) {
                invariant(
                    repeat < MAX_REPEAT,
                    "Repeat count too high, must be less than 20"
                )

                duration = calculateRepeatDuration(
                    duration,
                    repeat,
                    repeatDelay
                )

                const originalKeyframes = [...valueKeyframesAsList]
                const originalTimes = [...times]
                ease = Array.isArray(ease) ? [...ease] : [ease]
                const originalEase = [...ease]

                for (let repeatIndex = 0; repeatIndex < repeat; repeatIndex++) {
                    valueKeyframesAsList.push(...originalKeyframes)

                    for (
                        let keyframeIndex = 0;
                        keyframeIndex < originalKeyframes.length;
                        keyframeIndex++
                    ) {
                        times.push(
                            originalTimes[keyframeIndex] + (repeatIndex + 1)
                        )
                        ease.push(
                            keyframeIndex === 0
                                ? "linear"
                                : getEasingForSegment(
                                      originalEase,
                                      keyframeIndex - 1
                                  )
                        )
                    }
                }

                normalizeTimes(times, repeat)
            }

            const targetTime = startTime + duration

            /**
             * Add keyframes, mapping offsets to absolute time.
             */
            addKeyframes(
                valueSequence,
                valueKeyframesAsList,
                ease as Easing | Easing[],
                times,
                startTime,
                targetTime
            )

            maxDuration = Math.max(calculatedDelay + duration, maxDuration)
            totalDuration = Math.max(targetTime, totalDuration)
        }

        if (isMotionValue(subject)) {
            const subjectSequence = getSubjectSequence(subject, sequences)
            resolveValueSequence(
                keyframes as string | number,
                transition,
                getValueSequence("default", subjectSequence)
            )
        } else {
            const subjects = resolveSubjects(
                subject,
                keyframes as DOMKeyframesDefinition,
                scope,
                elementCache
            )

            const numSubjects = subjects.length

            /**
             * For every element in this segment, process the defined values.
             */
            for (
                let subjectIndex = 0;
                subjectIndex < numSubjects;
                subjectIndex++
            ) {
                /**
                 * Cast necessary, but we know these are of this type
                 */
                keyframes = keyframes as DOMKeyframesDefinition
                transition = transition as DynamicAnimationOptions

                const thisSubject = subjects[subjectIndex]
                const subjectSequence = getSubjectSequence(
                    thisSubject,
                    sequences
                )

                for (const key in keyframes) {
                    resolveValueSequence(
                        keyframes[
                            key as keyof typeof keyframes
                        ] as UnresolvedValueKeyframe,
                        getValueTransition(transition, key),
                        getValueSequence(key, subjectSequence),
                        subjectIndex,
                        numSubjects
                    )
                }
            }
        }

        prevTime = currentTime
        currentTime += maxDuration
    }

    /**
     * For every element and value combination create a new animation.
     */
    sequences.forEach((valueSequences, element) => {
        for (const key in valueSequences) {
            const valueSequence = valueSequences[key]

            /**
             * Arrange all the keyframes in ascending time order.
             */
            valueSequence.sort(compareByTime)

            const keyframes: UnresolvedValueKeyframe[] = []
            const valueOffset: number[] = []
            const valueEasing: Easing[] = []

            /**
             * For each keyframe, translate absolute times into
             * relative offsets based on the total duration of the timeline.
             */
            for (let i = 0; i < valueSequence.length; i++) {
                const { at, value, easing } = valueSequence[i]
                keyframes.push(value)
                valueOffset.push(progress(0, totalDuration, at))
                valueEasing.push(easing || "easeOut")
            }

            /**
             * If the first keyframe doesn't land on offset: 0
             * provide one by duplicating the initial keyframe. This ensures
             * it snaps to the first keyframe when the animation starts.
             */
            if (valueOffset[0] !== 0) {
                valueOffset.unshift(0)
                keyframes.unshift(keyframes[0])
                valueEasing.unshift(defaultSegmentEasing)
            }

            /**
             * If the last keyframe doesn't land on offset: 1
             * provide one with a null wildcard value. This will ensure it
             * stays static until the end of the animation.
             */
            if (valueOffset[valueOffset.length - 1] !== 1) {
                valueOffset.push(1)
                keyframes.push(null)
            }

            if (!animationDefinitions.has(element)) {
                animationDefinitions.set(element, {
                    keyframes: {},
                    transition: {},
                })
            }

            const definition = animationDefinitions.get(element)!

            definition.keyframes[key] = keyframes
            definition.transition[key] = {
                ...defaultTransition,
                duration: totalDuration,
                ease: valueEasing,
                times: valueOffset,
                ...sequenceTransition,
            }
        }
    })

    return animationDefinitions
}

function getSubjectSequence<O extends {}>(
    subject: Element | MotionValue | O,
    sequences: Map<Element | MotionValue | O, SequenceMap>
): SequenceMap {
    !sequences.has(subject) && sequences.set(subject, {})
    return sequences.get(subject)!
}

function getValueSequence(name: string, sequences: SequenceMap): ValueSequence {
    if (!sequences[name]) sequences[name] = []
    return sequences[name]
}

function keyframesAsList(
    keyframes: UnresolvedValueKeyframe | UnresolvedValueKeyframe[]
): UnresolvedValueKeyframe[] {
    return Array.isArray(keyframes) ? keyframes : [keyframes]
}

export function getValueTransition(
    transition: DynamicAnimationOptions & At,
    key: string
): DynamicAnimationOptions {
    return transition && transition[key as keyof typeof transition]
        ? {
              ...transition,
              ...(transition[key as keyof typeof transition] as Transition),
          }
        : { ...transition }
}

const isNumber = (keyframe: unknown) => typeof keyframe === "number"
const isNumberKeyframesArray = (
    keyframes: UnresolvedValueKeyframe[]
): keyframes is number[] => keyframes.every(isNumber)
