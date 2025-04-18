import { warning } from "motion-utils"
import { hex } from "../../value/types/color/hex"
import { hsla } from "../../value/types/color/hsla"
import { hslaToRgba } from "../../value/types/color/hsla-to-rgba"
import { rgba } from "../../value/types/color/rgba"
import { Color, HSLA, RGBA } from "../../value/types/types"
import { mixImmediate } from "./immediate"
import { mixNumber } from "./number"

// Linear color space blending
// Explained https://www.youtube.com/watch?v=LKnqECcg6Gw
// Demonstrated http://codepen.io/osublake/pen/xGVVaN
export const mixLinearColor = (from: number, to: number, v: number) => {
    const fromExpo = from * from
    const expo = v * (to * to - fromExpo) + fromExpo
    return expo < 0 ? 0 : Math.sqrt(expo)
}

const colorTypes = [hex, rgba, hsla]
const getColorType = (v: Color | string) =>
    colorTypes.find((type) => type.test(v))

function asRGBA(color: Color | string) {
    const type = getColorType(color)

    warning(
        Boolean(type),
        `'${color}' is not an animatable color. Use the equivalent color code instead.`
    )

    if (!Boolean(type)) return false

    let model = type!.parse(color)

    if (type === hsla) {
        // TODO Remove this cast - needed since Motion's stricter typing
        model = hslaToRgba(model as HSLA)
    }

    return model as RGBA
}

export const mixColor = (from: Color | string, to: Color | string) => {
    const fromRGBA = asRGBA(from)
    const toRGBA = asRGBA(to)

    if (!fromRGBA || !toRGBA) {
        return mixImmediate(from, to)
    }

    const blended = { ...fromRGBA }

    return (v: number) => {
        blended.red = mixLinearColor(fromRGBA.red, toRGBA.red, v)
        blended.green = mixLinearColor(fromRGBA.green, toRGBA.green, v)
        blended.blue = mixLinearColor(fromRGBA.blue, toRGBA.blue, v)
        blended.alpha = mixNumber(fromRGBA.alpha, toRGBA.alpha, v)
        return rgba.transform!(blended)
    }
}
