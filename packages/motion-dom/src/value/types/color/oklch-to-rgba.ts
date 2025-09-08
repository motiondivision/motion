import { OKLCH, RGBA } from "../types"

interface OKLAB {
    lightness: number
    a: number
    b: number
    alpha?: number
}

interface LRGB {
    red: number
    green: number
    blue: number
    alpha?: number
}

// References:
//   * https://drafts.csswg.org/css-color/#lch-to-lab
//   * https://drafts.csswg.org/css-color/#color-conversion-code
const convertOklchToOklab = ({
    lightness,
    chroma,
    hue,
    alpha,
}: OKLCH): OKLAB => {
    if (hue === undefined) hue = 0

    const res: OKLAB = {
        lightness: lightness,
        a: chroma ? chroma * Math.cos((hue / 180) * Math.PI) : 0,
        b: chroma ? chroma * Math.sin((hue / 180) * Math.PI) : 0,
    }

    if (alpha !== undefined) res.alpha = alpha

    return res
}

const convertOklabToLrgb = ({ lightness, a, b, alpha }: OKLAB): LRGB => {
    if (lightness === undefined) lightness = 0
    if (a === undefined) a = 0
    if (b === undefined) b = 0

    const long = Math.pow(
        lightness + 0.3963377773761749 * a + 0.2158037573099136 * b,
        3
    )
    const medium = Math.pow(
        lightness - 0.1055613458156586 * a - 0.0638541728258133 * b,
        3
    )
    const short = Math.pow(
        lightness - 0.0894841775298119 * a - 1.2914855480194092 * b,
        3
    )

    const res: LRGB = {
        red:
            4.0767416360759574 * long -
            3.3077115392580616 * medium +
            0.2309699031821044 * short,
        green:
            -1.2684379732850317 * long +
            2.6097573492876887 * medium -
            0.3413193760026573 * short,
        blue:
            -0.0041960761386756 * long -
            0.7034186179359362 * medium +
            1.7076146940746117 * short,
    }

    if (alpha !== undefined) {
        res.alpha = alpha
    }

    return res
}

const gammaCorrection = (component = 0) => {
    const abs = Math.abs(component)
    if (abs > 0.0031308) {
        return (
            (Math.sign(component) || 1) *
            (1.055 * Math.pow(abs, 1 / 2.4) - 0.055)
        )
    }
    return component * 12.92
}

const convertLrgbToRgba = ({ red, green, blue, alpha }: LRGB): RGBA => {
    const res: RGBA = {
        red: gammaCorrection(red),
        green: gammaCorrection(green),
        blue: gammaCorrection(blue),
        alpha: alpha ?? 1,
    }
    return res
}

// Adapted from https://github.com/Evercoder/culori/blob/493ef9f4f4e4cd39a5fcd335d49440d3b7ae59f9/src/oklch/definition.js
export function oklchToRgba({ lightness, chroma, hue, alpha }: OKLCH): RGBA {
    lightness /= 100

    const oklab = convertOklchToOklab({
        lightness,
        chroma,
        hue,
        alpha,
    })

    const lrgb = convertOklabToLrgb(oklab)

    const rgba = convertLrgbToRgba(lrgb)

    return {
        red: Math.round(rgba.red * 255),
        green: Math.round(rgba.green * 255),
        blue: Math.round(rgba.blue * 255),
        alpha: rgba.alpha,
    }
}
