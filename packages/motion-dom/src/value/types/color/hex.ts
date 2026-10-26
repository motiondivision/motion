import { RGBA } from "../types"
import { rgba } from "./rgba"
import { isColorString } from "./utils"

/**
 * #FF0000 has two characters per channel, #F00 one, which is doubled.
 */
const channel = (v: string, i: number, size: number) => {
    const c = v.substring(1 + i * size, 1 + (i + 1) * size)
    return size > 1 ? c : c + c
}

function parseHex(v: string): RGBA {
    const size = v.length > 5 ? 2 : 1
    const alpha = channel(v, 3, size)

    return {
        red: parseInt(channel(v, 0, size), 16),
        green: parseInt(channel(v, 1, size), 16),
        blue: parseInt(channel(v, 2, size), 16),
        alpha: alpha ? parseInt(alpha, 16) / 255 : 1,
    }
}

export const hex = {
    test: /*@__PURE__*/ isColorString("#"),
    parse: parseHex,
    transform: rgba.transform,
}
