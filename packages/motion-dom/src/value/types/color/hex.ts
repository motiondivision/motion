import { RGBA } from "../types"
import { rgba } from "./rgba"
import { isColorString } from "./utils"

/**
 * Matches 3, 4, 6, or 8 character hex strings without #,
 * requiring at least one a-f letter to avoid matching pure numbers.
 */
const isHexWithoutHash = /^[\da-f]*[a-f][\da-f]*$/iu

function parseHex(v: string): RGBA {
    if (!v.startsWith("#")) v = "#" + v

    let r = ""
    let g = ""
    let b = ""
    let a = ""

    // If we have 6 characters, ie #FF0000
    if (v.length > 5) {
        r = v.substring(1, 3)
        g = v.substring(3, 5)
        b = v.substring(5, 7)
        a = v.substring(7, 9)

        // Or we have 3 characters, ie #F00
    } else {
        r = v.substring(1, 2)
        g = v.substring(2, 3)
        b = v.substring(3, 4)
        a = v.substring(4, 5)
        r += r
        g += g
        b += b
        a += a
    }

    return {
        red: parseInt(r, 16),
        green: parseInt(g, 16),
        blue: parseInt(b, 16),
        alpha: a ? parseInt(a, 16) / 255 : 1,
    }
}

const testHash = /*@__PURE__*/ isColorString("#")

export const hex = {
    test: (v: any) =>
        testHash(v) ||
        (typeof v === "string" &&
            v.length >= 3 &&
            v.length <= 8 &&
            isHexWithoutHash.test(v)),
    parse: parseHex,
    transform: rgba.transform,
}
