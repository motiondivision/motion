import { progress as calcProgress, noop } from "motion-utils"
import { circOut } from "../../easing/circ"
import { EasingFunction } from "../../easing/types"
import { ResolvedValues } from "../../render/types"
import { mixNumber } from "../../utils/mix/number"
import { percent, px } from "../../value/types/numbers/units"

const borders = ["TopLeft", "TopRight", "BottomLeft", "BottomRight"]
const numBorders = borders.length

const asNumber = (value: string | number) =>
    typeof value === "string" ? parseFloat(value) : value

const isPx = (value: string | number) =>
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
            // TODO Reinstate this if only child
            lead.opacity !== undefined ? (lead.opacity as number) : 1,
            easeCrossfadeIn(progress)
        )
        target.opacityExit = mixNumber(
            follow.opacity !== undefined ? (follow.opacity as number) : 1,
            0,
            easeCrossfadeOut(progress)
        )
    } else if (isOnlyMember) {
        target.opacity = mixNumber(
            follow.opacity !== undefined ? (follow.opacity as number) : 1,
            lead.opacity !== undefined ? (lead.opacity as number) : 1,
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

// /**
//  * We only want to mix the background color if there's a follow element
//  * that we're not crossfading opacity between. For instance with switch
//  * AnimateSharedLayout animations, this helps the illusion of a continuous
//  * element being animated but also cuts down on the number of paints triggered
//  * for elements where opacity is doing that work for us.
//  */
// if (
//     !hasFollowElement &&
//     latestLeadValues.backgroundColor &&
//     latestFollowValues.backgroundColor
// ) {
//     /**
//      * This isn't ideal performance-wise as mixColor is creating a new function every frame.
//      * We could probably create a mixer that runs at the start of the animation but
//      * the idea behind the crossfader is that it runs dynamically between two potentially
//      * changing targets (ie opacity or borderRadius may be animating independently via variants)
//      */
//     leadState.backgroundColor = followState.backgroundColor = mixColor(
//         latestFollowValues.backgroundColor as string,
//         latestLeadValues.backgroundColor as string
//     )(p)
// }

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
