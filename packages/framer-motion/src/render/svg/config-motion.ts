import { frame, transformProps } from "motion-dom"
import { MotionComponentConfig } from "../../motion"
import { makeUseVisualState } from "../../motion/utils/use-visual-state"
import { SVGRenderState } from "./types"
import { buildSVGAttrs } from "./utils/build-attrs"
import { createSvgRenderState } from "./utils/create-render-state"
import { isSVGTag } from "./utils/is-svg-tag"
import { updateSVGDimensions } from "./utils/measure"
import { renderSVG } from "./utils/render"
import { scrapeMotionValuesFromProps as scrapeSVGProps } from "./utils/scrape-motion-values"

const layoutProps = ["x", "y", "width", "height", "cx", "cy", "r"]

export const svgMotionConfig: Partial<
    MotionComponentConfig<SVGElement, SVGRenderState>
> = {
    useVisualState: makeUseVisualState({
        scrapeMotionValuesFromProps: scrapeSVGProps,
        createRenderState: createSvgRenderState,
        onUpdate: ({
            props,
            prevProps,
            current,
            renderState,
            latestValues,
        }) => {
            if (!current) return

            let hasTransform = !!props.drag
            if (!hasTransform) {
                for (const key in latestValues) {
                    if (transformProps.has(key)) {
                        hasTransform = true
                        break
                    }
                }
            }

            if (!hasTransform) return

            let needsMeasure = !prevProps

            if (prevProps) {
                /**
                 * Check the layout props for changes, if any are found we need to
                 * measure the element again.
                 */
                for (let i = 0; i < layoutProps.length; i++) {
                    const key = layoutProps[i]

                    if (
                        props[key as keyof typeof props] !==
                        prevProps[key as keyof typeof prevProps]
                    ) {
                        needsMeasure = true
                    }
                }
            }

            if (!needsMeasure) return

            frame.read(() => {
                updateSVGDimensions(current, renderState)

                frame.render(() => {
                    buildSVGAttrs(
                        renderState,
                        latestValues,
                        isSVGTag(current.tagName),
                        props.transformTemplate
                    )

                    renderSVG(current, renderState)
                })
            })
        },
    }),
}
