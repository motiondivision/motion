import { createBox } from "../../projection/geometry/models"
import { ResolvedValues, VisualElementOptions } from "../types"
import { VisualElement } from "../VisualElement"

interface ObjectRenderState {
    output: ResolvedValues
}

function isObjectKey(key: string, object: Object): key is keyof Object {
    return key in object
}

export class ObjectVisualElement extends VisualElement<
    Object,
    ObjectRenderState
> {
    type = "object"

    /**
     * Declared rather than implicit, as the implicit constructor compiles
     * to super(...arguments), which is slow to run per element.
     */
    constructor(
        options: VisualElementOptions<Object, ObjectRenderState>,
        renderOptions?: {}
    ) {
        super(options, renderOptions)
    }

    readValueFromInstance(instance: Object, key: string) {
        if (isObjectKey(key, instance)) {
            const value = instance[key]
            if (typeof value === "string" || typeof value === "number") {
                return value
            }
        }

        return undefined
    }

    getBaseTargetFromProps() {
        return undefined
    }

    removeValueFromRenderState(
        key: string,
        renderState: ObjectRenderState
    ): void {
        delete renderState.output[key]
    }

    measureInstanceViewportBox() {
        return createBox()
    }

    build(renderState: ObjectRenderState, latestValues: ResolvedValues) {
        Object.assign(renderState.output, latestValues)
    }

    renderInstance(instance: Object, { output }: ObjectRenderState) {
        Object.assign(instance, output)
    }

    sortInstanceNodePosition() {
        return 0
    }
}
