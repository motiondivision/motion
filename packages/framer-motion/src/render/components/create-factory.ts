import {
    createRendererMotionComponent,
    MotionComponentProps,
} from "../../motion"
import { FeaturePackages } from "../../motion/features/types"
import { DOMMotionComponents } from "../dom/types"
import { createUseRender } from "../dom/use-render"
import { isSVGComponent } from "../dom/utils/is-svg-component"
import { htmlMotionConfig } from "../html/config-motion"
import { svgMotionConfig } from "../svg/config-motion"
import { CreateVisualElement } from "../types"

type MotionComponent<T, P> = T extends keyof DOMMotionComponents
    ? DOMMotionComponents[T]
    : React.ComponentType<
          Omit<MotionComponentProps<P>, "children"> & {
              children?: "children" extends keyof P
                  ? P["children"] | MotionComponentProps<P>["children"]
                  : MotionComponentProps<P>["children"]
          }
      >

export function createMotionComponentFactory(
    preloadedFeatures?: FeaturePackages,
    createVisualElement?: CreateVisualElement<any>
) {
    return function createMotionComponent<
        Props,
        TagName extends keyof DOMMotionComponents | string = "div"
    >(
        Component: TagName | string | React.ComponentType<Props>,
        { forwardMotionProps } = { forwardMotionProps: false }
    ) {
        const baseConfig = isSVGComponent(Component)
            ? svgMotionConfig
            : htmlMotionConfig

        const config = {
            ...baseConfig,
            preloadedFeatures,
            useRender: createUseRender(forwardMotionProps),
            createVisualElement,
            Component,
        }

        return createRendererMotionComponent(config as any) as MotionComponent<
            TagName,
            Props
        >
    }
}
