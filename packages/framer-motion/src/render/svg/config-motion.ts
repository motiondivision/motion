import { MotionComponentConfig } from "../../motion"
import { makeUseVisualState } from "../../motion/utils/use-visual-state"
import { SVGRenderState } from "./types"
import { createSvgRenderState } from "./utils/create-render-state"
import { scrapeMotionValuesFromProps as scrapeSVGProps } from "./utils/scrape-motion-values"

export const svgMotionConfig: Partial<
    MotionComponentConfig<SVGElement, SVGRenderState>
> = {
    useVisualState: makeUseVisualState({
        scrapeMotionValuesFromProps: scrapeSVGProps,
        createRenderState: createSvgRenderState,
    }),
}
