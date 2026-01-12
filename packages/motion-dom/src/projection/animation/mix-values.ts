import type { AnyResolvedKeyframe } from "../../animation/types"
import { mixNumber } from "../../utils/mix/number"
import { percent, px } from "../../value/types/numbers/units"
import {
    progress as calcProgress,
    circOut,
    EasingFunction,
    noop,
} from "motion-utils"
import { ResolvedValues } from "../../render/types"

const borders = ["TopLeft", "TopRight", "BottomLeft", "BottomRight"]
const numBorders = borders.length

const asNumber = (value: AnyResolvedKeyframe) =>
    typeof value === "string" ? parseFloat(value) : value

const isPx = (value: AnyResolvedKeyframe) =>
    typeof value === "number" || px.test(value)

export function mixValues(
    target: ResolvedValues,
    follow: ResolvedValues,
    lead: ResolvedValues,
    progress: number,
    shouldCrossfadeOpacity: boolean,
    isOnlyMember: boolean
) {
    if (shouldCrossfadeOpacity) {
        target.opacity = mixNumber(
            0,
            (lead.opacity as number) ?? 1,
            easeCrossfadeIn(progress)
        )
        target.opacityExit = mixNumber(
            (follow.opacity as number) ?? 1,
            0,
            easeCrossfadeOut(progress)
        )
    } else if (isOnlyMember) {
        target.opacity = mixNumber(
            (follow.opacity as number) ?? 1,
            (lead.opacity as number) ?? 1,
            progress
        )
    }

    /**
     * Mix border radius
     */
    for (let i = 0; i < numBorders; i++) {
        const borderLabel = `border${borders[i]}Radius`
        let followRadius = getRadius(follow, borderLabel)
        let leadRadius = getRadius(lead, borderLabel)

        if (followRadius === undefined && leadRadius === undefined) continue

        followRadius ||= 0
        leadRadius ||= 0

        const canMix =
            followRadius === 0 ||
            leadRadius === 0 ||
            isPx(followRadius) === isPx(leadRadius)

        if (canMix) {
            target[borderLabel] = Math.max(
                mixNumber(
                    asNumber(followRadius),
                    asNumber(leadRadius),
                    progress
                ),
                0
            )

            if (percent.test(leadRadius) || percent.test(followRadius)) {
                target[borderLabel] += "%"
            }
        } else {
            target[borderLabel] = leadRadius
        }
    }

    /**
     * Mix rotation
     */
    if (follow.rotate || lead.rotate) {
        target.rotate = mixNumber(
            (follow.rotate as number) || 0,
            (lead.rotate as number) || 0,
            progress
        )
    }
}

function getRadius(values: ResolvedValues, radiusName: string) {
    return values[radiusName] !== undefined
        ? values[radiusName]
        : values.borderRadius
}

const easeCrossfadeIn = /*@__PURE__*/ compress(0, 0.5, circOut)
const easeCrossfadeOut = /*@__PURE__*/ compress(0.5, 0.95, noop)

function compress(
    min: number,
    max: number,
    easing: EasingFunction
): EasingFunction {
    return (p: number) => {
        // Could replace ifs with clamp
        if (p < min) return 0
        if (p > max) return 1
        return easing(calcProgress(min, max, p))
    }
}
