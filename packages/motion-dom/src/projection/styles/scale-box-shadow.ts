import {
    analyseComplexValue,
    buildTransformer,
    ComplexValues,
} from "../../value/types/complex"
import { mixNumber } from "../../utils/mix/number"
import type { ScaleCorrectorDefinition } from "./types"

/**
 * The last shadow parsed. A shadow is usually static while its element's
 * layout animates, so it's parsed once rather than every frame.
 */
let lastShadow: string | undefined
let lastValues: ComplexValues
let lastTemplate: (v: ComplexValues) => string

export const correctBoxShadow: ScaleCorrectorDefinition = {
    correct: (latest: string, { treeScale, projectionDelta }) => {
        if (latest !== lastShadow) {
            const info = analyseComplexValue(latest)
            lastShadow = latest
            lastValues = info.values
            lastTemplate = buildTransformer(info)
        }

        // TODO: Doesn't support multiple shadows
        if (lastValues.length > 5) return latest

        const shadow = lastValues.slice()
        const template = lastTemplate
        const offset = typeof shadow[0] !== "number" ? 1 : 0

        // Calculate the overall context scale
        const xScale = projectionDelta!.x.scale * treeScale!.x
        const yScale = projectionDelta!.y.scale * treeScale!.y

        // Scale x/y
        ;(shadow[0 + offset] as number) /= xScale
        ;(shadow[1 + offset] as number) /= yScale

        /**
         * Ideally we'd correct x and y scales individually, but because blur and
         * spread apply to both we have to take a scale average and apply that instead.
         * We could potentially improve the outcome of this by incorporating the ratio between
         * the two scales.
         */
        const averageScale = mixNumber(xScale, yScale, 0.5)

        // Blur
        if (typeof shadow[2 + offset] === "number")
            (shadow[2 + offset] as number) /= averageScale

        // Spread
        if (typeof shadow[3 + offset] === "number")
            (shadow[3 + offset] as number) /= averageScale

        return template(shadow)
    },
}
