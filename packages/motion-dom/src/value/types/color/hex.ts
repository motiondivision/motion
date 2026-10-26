import { RGBA } from "../types"
import { rgba } from "./rgba"
import { isColorString } from "./utils"

function parseHex(v: string): RGBA {
    /**
     * #FF0000 has two characters per channel, #F00 one, which is doubled.
     */
    const size = v.length > 5 ? 2 : 1
    const [r, g, b, a] = [1, 2, 3, 4].map((i) => {
        const channel = v.substring(i * size - size + 1, i * size + 1)
        return size > 1 ? channel : channel + channel
    })

    return {
        red: parseInt(r, 16),
        green: parseInt(g, 16),
        blue: parseInt(b, 16),
        alpha: a ? parseInt(a, 16) / 255 : 1,
    }
}

export const hex = {
    test: /*@__PURE__*/ isColorString("#"),
    parse: parseHex,
    transform: rgba.transform,
}
