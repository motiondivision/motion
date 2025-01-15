import type {
    CreateVisualElement,
    ResolvedValues,
    MotionProps,
} from "framer-motion"

import { createBox, VisualElement } from "framer-motion"
import { Object3DNode } from "@react-three/fiber"

import { setThreeValue } from "./utils/set-value"
import { readThreeValue } from "./utils/read-value"
import { ThreeRenderState } from "../types"
import { scrapeMotionValuesFromProps } from "./utils/scrape-motion-value"

export const createRenderState = () => ({})

function hasId(obj: any): obj is { id: number } {
    return "id" in obj && typeof obj.id === "number"
}

export class ThreeVisualElement extends VisualElement<
    Object3DNode<any, any>,
    ThreeRenderState,
    {}
> {
    type = "three"

    readValueFromInstance(instance: Object3DNode<any, any>, key: string) {
        return readThreeValue(instance, key)
    }

    getBaseTargetFromProps() {
        return undefined
    }

    sortInstanceNodePosition(
        a: Object3DNode<any, any>,
        b: Object3DNode<any, any>
    ) {
        if (hasId(a) && hasId(b)) {
            return a.id - b.id
        }
        return 0
    }

    removeValueFromRenderState() {}

    measureInstanceViewportBox = createBox

    scrapeMotionValuesFromProps(props: MotionProps, prevProps: MotionProps) {
        return scrapeMotionValuesFromProps(props, prevProps)
    }

    build(state: ThreeRenderState, latestValues: ResolvedValues) {
        for (const key in latestValues) {
            state[key] = latestValues[key]
        }
    }

    renderInstance(
        instance: Object3DNode<any, any>,
        renderState: ThreeRenderState
    ) {
        for (const key in renderState) {
            setThreeValue(instance, key, renderState)
        }
    }
}

export const createVisualElement: CreateVisualElement<any> = (_, options) =>
    new ThreeVisualElement(options, {})
