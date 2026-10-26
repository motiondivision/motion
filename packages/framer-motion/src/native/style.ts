import type { NativeValues } from "./types"

/**
 * Motion's transform values in the order Motion applies them, with React
 * Native's name for each. React Native has no z translation, 3D scale or
 * two-axis skew, so those are dropped.
 */
const transforms = [
    ["transformPerspective", "perspective"],
    ["x", "translateX"],
    ["y", "translateY"],
    ["translateX", "translateX"],
    ["translateY", "translateY"],
    ["z", ""],
    ["translateZ", ""],
    ["scale", "scale"],
    ["scaleX", "scaleX"],
    ["scaleY", "scaleY"],
    ["scaleZ", ""],
    ["rotate", "rotate"],
    ["rotateX", "rotateX"],
    ["rotateY", "rotateY"],
    ["rotateZ", "rotateZ"],
    ["skew", ""],
    ["skewX", "skewX"],
    ["skewY", "skewY"],
]

const origins = ["originX", "originY", "originZ"]

/**
 * Build a React Native style from Motion's values. Runs on the UI thread
 * every time a value changes.
 */
export function buildNativeStyle(values: NativeValues) {
    "worklet"
    const style: { [key: string]: any } = {}
    let transform: object[] | undefined
    let hasOrigin = false

    for (const key in values) style[key] = values[key]

    for (let i = 0; i < transforms.length; i++) {
        const [key, nativeKey] = transforms[i]
        const value = values[key]
        delete style[key]
        if (value === undefined || !nativeKey) continue

        ;(transform ||= []).push({
            [nativeKey]:
                typeof value === "number" &&
                (key.startsWith("rotate") || key.startsWith("skew"))
                    ? value + "deg"
                    : value,
        })
    }

    for (let i = 0; i < origins.length; i++) {
        if (origins[i] in style) {
            hasOrigin = true
            delete style[origins[i]]
        }
    }

    if (transform) style.transform = transform

    if (hasOrigin) {
        const { originX = 0.5, originY = 0.5, originZ = 0 } = values
        const toPercent = (v: string | number) => {
            "worklet"
            return typeof v === "number" ? v * 100 + "%" : v
        }
        style.transformOrigin = [toPercent(originX), toPercent(originY), originZ]
    }

    return style
}
