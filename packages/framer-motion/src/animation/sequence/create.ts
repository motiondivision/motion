import {
    AnimationScope,
    createGeneratorEasing,
    defaultOffset,
    DOMKeyframesDefinition,
    AnimationOptions as DynamicAnimationOptions,
    fillOffset,
    GeneratorFactory,
    isGenerator,
    isMotionValue,
    Transition,
    UnresolvedValueKeyframe,
    type AnyResolvedKeyframe,
    type MotionValue,
} from "motion-dom"
import {
    Easing,
    getEasingForSegment,
    progress,
    reverseEasing,
    secondsToMilliseconds,
    warning,
} from "motion-utils"
import { resolveSubjects } from "../animate/resolve-subjects"
import {
    AnimationSequence,
    At,
    ResolvedAnimationDefinitions,
    SequenceMap,
    SequenceInfo,
    SequenceOptions,
    SequenceTime,
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
    generators?: { [key: string]: GeneratorFactory },
    info?: SequenceInfo
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
     *
     * Nested sequences are resolved recursively. `base` is the absolute
     * start of the sequence being resolved, so numeric `at` values inside
     * a nested sequence are relative to where it starts. Returns the time
     * the sequence ends.
     */
    const resolveSequence = (sequence: AnimationSequence, base: number) => {
        let sequenceEnd = base

        const resolveTime = (at: SequenceTime) =>
            typeof at === "number"
                ? base + at
                : calcNextTime(currentTime, at, prevTime, timeLabels)

        for (let i = 0; i < sequence.length; i++) {
            const segment = sequence[i]

            /**
             * If this is a timeline label, mark it and skip the rest of this iteration.
             */
            if (typeof segment === "string") {
                timeLabels.set(segment, currentTime)
                continue
            } else if (!Array.isArray(segment)) {
                const start =
                    segment.at === undefined
                        ? currentTime
                        : resolveTime(segment.at)

                if ("sequence" in segment) {
                    /**
                     * Resolve the nested sequence from its start. Afterwards
                     * "<" points at its start and the next segment follows
                     * its end, as if it were a single segment.
                     */
                    prevTime = currentTime = start
                    currentTime = resolveSequence(segment.sequence, start)
                    prevTime = start
                    sequenceEnd = Math.max(sequenceEnd, currentTime)
                } else {
                    timeLabels.set(segment.name, start)
                }
                continue
            }

            let [subject, keyframes, transition = {}] = segment

            /**
             * If a relative or absolute time value has been specified we need to resolve
             * it in relation to the currentTime.
             */
            if (transition.at !== undefined) {
                currentTime = resolveTime(transition.at)
            }

            /**
             * Keep track of the maximum duration in this definition. This will be
             * applied to currentTime once the definition has been parsed.
             */
            let maxDuration = 0

            const resolveValueSequence = (
                valueKeyframes:
                    | UnresolvedValueKeyframe
                    | UnresolvedValueKeyframe[],
                valueTransition: Transition | DynamicAnimationOptions,
                valueSequence: ValueSequence,
                elementIndex = 0,
                numSubjects = 0
            ) => {
                const valueKeyframesAsList = keyframesAsList(valueKeyframes)
                const {
                    delay = 0,
                    times = defaultOffset(valueKeyframesAsList),
                    type = defaultTransition.type || "keyframes",
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
                    : generators?.[type || "keyframes"]

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

                    const springTransition = {
                        ...defaultTransition,
                        ...remainingTransition,
                    }
                    if (duration !== undefined) {
                        springTransition.duration =
                            secondsToMilliseconds(duration)
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
                 * Segments can't express `repeat: Infinity` or very large
                 * counts — they'd leave dead time after the segment or
                 * explode the keyframe array. Ignore with a warning.
                 */
                if (repeat) {
                    warning(
                        repeat < MAX_REPEAT,
                        `Sequence segments can't repeat ${repeat} times — ignoring repeat option. Use a value below ${MAX_REPEAT} or apply repeat at the sequence level instead.`
                    )
                }

                if (repeat && repeat < MAX_REPEAT) {
                    /**
                     * Express repeatDelay in units of a single iteration's duration
                     * so it can be added to the per-iteration time offsets below
                     * before they're normalized to 0-1.
                     */
                    const repeatDelayUnits =
                        duration > 0 ? repeatDelay / duration : 0

                    duration = calculateRepeatDuration(
                        duration,
                        repeat,
                        repeatDelay
                    )

                    const originalKeyframes = [...valueKeyframesAsList]
                    const originalTimes = [...times]
                    ease = Array.isArray(ease) ? [...ease] : [ease]
                    const originalEase = [...ease]

                    /**
                     * For reverse/mirror, alternate iterations play the segment
                     * backwards. mirror matches JSAnimation's mirroredGenerator:
                     * reversed keyframes, easings unchanged. reverse matches
                     * JSAnimation's iterationProgress = 1 - p: reversed
                     * keyframes, easing array reversed AND each function easing
                     * mapped through reverseEasing (string easings unchanged —
                     * they're resolved later by the keyframes engine).
                     */
                    const isFlipping =
                        repeatType === "reverse" || repeatType === "mirror"
                    let flippedKeyframes = originalKeyframes
                    let flippedEases = originalEase
                    if (isFlipping) {
                        flippedKeyframes = [...originalKeyframes].reverse()
                        if (repeatType === "reverse") {
                            flippedEases = [...originalEase]
                                .reverse()
                                .map((e) =>
                                    typeof e === "function"
                                        ? reverseEasing(e)
                                        : e
                                )
                        }
                    }

                    for (
                        let repeatIndex = 0;
                        repeatIndex < repeat;
                        repeatIndex++
                    ) {
                        const isFlipped = isFlipping && repeatIndex % 2 === 0
                        const iterKeyframes = isFlipped
                            ? flippedKeyframes
                            : originalKeyframes
                        const iterEase = isFlipped ? flippedEases : originalEase
                        const iterStartOffset =
                            (repeatIndex + 1) * (1 + repeatDelayUnits)

                        /**
                         * If repeatDelay is set, hold the previous iteration's
                         * final value through the delay by inserting a keyframe
                         * at the moment the next iteration begins.
                         */
                        if (repeatDelayUnits > 0) {
                            valueKeyframesAsList.push(
                                valueKeyframesAsList[
                                    valueKeyframesAsList.length - 1
                                ]
                            )
                            times.push(iterStartOffset)
                            ease.push("linear")
                        }

                        valueKeyframesAsList.push(...iterKeyframes)

                        for (
                            let keyframeIndex = 0;
                            keyframeIndex < iterKeyframes.length;
                            keyframeIndex++
                        ) {
                            times.push(
                                originalTimes[keyframeIndex] + iterStartOffset
                            )
                            ease.push(
                                keyframeIndex === 0
                                    ? "linear"
                                    : getEasingForSegment(
                                          iterEase,
                                          keyframeIndex - 1
                                      )
                            )
                        }
                    }

                    normalizeTimes(times, repeat, repeatDelayUnits)
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
                    keyframes as AnyResolvedKeyframe,
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
            sequenceEnd = Math.max(sequenceEnd, currentTime)
        }

        return sequenceEnd
    }

    resolveSequence(sequence, 0)

    if (info) {
        info.duration = totalDuration
        info.labels = timeLabels
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

            /**
             * Exclude `type` from defaultTransition since springs have been
             * converted to duration-based easing functions in resolveValueSequence.
             * Including `type: "spring"` would cause JSAnimation to error when
             * the merged keyframes array has more than 2 keyframes.
             */
            const { type: _type, ...remainingDefaultTransition } =
                defaultTransition
            definition.transition[key] = {
                ...remainingDefaultTransition,
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
