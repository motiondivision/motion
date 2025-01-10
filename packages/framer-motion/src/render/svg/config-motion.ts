import { frame } from "../../frameloop/frame"
import { MotionComponentConfig } from "../../motion"
import { makeUseVisualState } from "../../motion/utils/use-visual-state"
import { transformProps } from "../html/utils/keys-transform"
import { SVGRenderState } from "./types"
import { buildSVGAttrs } from "./utils/build-attrs"
import { createSvgRenderState } from "./utils/create-render-state"
import { isSVGTag } from "./utils/is-svg-tag"
import { renderSVG } from "./utils/render"
import { scrapeMotionValuesFromProps as scrapeSVGProps } from "./utils/scrape-motion-values"

function updateSVGDimensions(
    instance: SVGElement,
    renderState: SVGRenderState
) {
    try {
        renderState.dimensions =
            typeof (instance as SVGGraphicsElement).getBBox === "function"
                ? (instance as SVGGraphicsElement).getBBox()
                : (instance.getBoundingClientRect() as DOMRect)
    } catch (e) {
        // Most likely trying to measure an unrendered element under Firefox
        renderState.dimensions = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
        }
    }
}

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

            let hasTransform = false
            for (const key in latestValues) {
                if (transformProps.has(key)) {
                    hasTransform = true
                    break
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

            frame.read(() => updateSVGDimensions(current, renderState))

            frame.render(() => {
                buildSVGAttrs(
                    renderState,
                    latestValues,
                    isSVGTag(current.tagName),
                    props.transformTemplate
                )

                renderSVG(current, renderState)
            })
        },
    }),
}
