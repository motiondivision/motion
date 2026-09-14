import { hasComplexValues } from "../../../value/types/complex"
import { getAnimatableNone } from "../../../value/types/utils/animatable-none"
import { AnyResolvedKeyframe } from "../../types"
import { UnresolvedKeyframes } from "../KeyframesResolver"

/**
 * If we encounter keyframes like "none" or "0" and we also have keyframes like
 * "#fff" or "200px 200px" we want to find a keyframe to serve as a template for
 * the "none" keyframes. In this case "#fff" or "200px 200px" - then these get turned into
 * zero equivalents, i.e. "#fff0" or "0px 0px".
 */
const invalidTemplates = new Set(["auto", "none", "0"])

export function makeNoneKeyframesAnimatable(
    unresolvedKeyframes: UnresolvedKeyframes<AnyResolvedKeyframe>,
    noneKeyframeIndexes: number[],
    name?: string
) {
    let i = 0
    let animatableTemplate: string | undefined = undefined
    while (i < unresolvedKeyframes.length && !animatableTemplate) {
        const keyframe = unresolvedKeyframes[i]
        if (
            typeof keyframe === "string" &&
            !invalidTemplates.has(keyframe) &&
            hasComplexValues(keyframe)
        ) {
            animatableTemplate = unresolvedKeyframes[i] as string
        }
        i++
    }

    if (animatableTemplate && name) {
        for (const noneIndex of noneKeyframeIndexes) {
            /**
             * A zero-valued template like "0%" is already its own
             * animatable none, so there's nothing to derive.
             */
            if (unresolvedKeyframes[noneIndex] === animatableTemplate) continue

            unresolvedKeyframes[noneIndex] = getAnimatableNone(
                name,
                animatableTemplate
            )
        }
    }
}
