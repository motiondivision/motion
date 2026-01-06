import { isCSSVar } from "../render/dom/is-css-var"
import { transformPropOrder, transformProps } from "../render/utils/keys-transform"
import { MotionValue } from "../value"
import { getValueAsType } from "../value/types/utils/get-as-type"
import { numberValueTypes } from "../value/types/maps/number"
import { MotionValueState } from "./MotionValueState"
import { AnyResolvedKeyframe } from "../animation/types"

const originProps = new Set(["originX", "originY", "originZ"])

const translateAlias: Record<string, string> = {
    x: "translateX",
    y: "translateY",
    z: "translateZ",
    transformPerspective: "perspective",
}

export interface HTMLMotionValueStateOptions {
    element: HTMLElement | SVGElement | null
    getTransformTemplate?: () =>
        | ((
              transform: Record<string, AnyResolvedKeyframe>,
              generatedTransform: string
          ) => string)
        | undefined
    onTransformChange?: () => void
    onUpdate?: () => void
    onValueChange?: (key: string, value: AnyResolvedKeyframe) => void
    /**
     * Get the full latestValues including values not in state.
     * Used by buildTransformString to include all transform values.
     */
    getLatestValues?: () => Record<string, AnyResolvedKeyframe>
}

export class HTMLMotionValueState extends MotionValueState {
    protected element: HTMLElement | SVGElement | null
    protected getTransformTemplate?: () =>
        | ((
              transform: Record<string, AnyResolvedKeyframe>,
              generatedTransform: string
          ) => string)
        | undefined
    protected onTransformChange?: () => void
    protected onUpdate?: () => void
    protected onValueChangeCallback?: (key: string, value: AnyResolvedKeyframe) => void
    protected getLatestValues?: () => Record<string, AnyResolvedKeyframe>

    constructor(options: HTMLMotionValueStateOptions) {
        super()
        this.element = options.element
        this.getTransformTemplate = options.getTransformTemplate
        this.onTransformChange = options.onTransformChange
        this.onUpdate = options.onUpdate
        this.onValueChangeCallback = options.onValueChange
        this.getLatestValues = options.getLatestValues
    }

    setElement(element: HTMLElement | SVGElement) {
        this.element = element
    }

    protected override onValueChange(name: string, value: AnyResolvedKeyframe): void {
        this.onValueChangeCallback?.(name, value)
    }

    add(
        key: string,
        value: MotionValue,
        useDefaultValueType = true
    ): VoidFunction {
        const element = this.element
        if (!element) {
            // If no element yet, store in base class without render callback
            return super.set(key, value, undefined, undefined, useDefaultValueType)
        }

        let render: VoidFunction | undefined = undefined
        let computed: MotionValue | undefined = undefined

        if (transformProps.has(key)) {
            if (!this.get("transform")) {
                this.set(
                    "transform",
                    new MotionValue("none"),
                    this.createTransformRender(element)
                )
            }
            computed = this.get("transform")
        } else if (originProps.has(key)) {
            if (!this.get("transformOrigin")) {
                this.set("transformOrigin", new MotionValue(""), () => {
                    const originX = this.latest.originX ?? "50%"
                    const originY = this.latest.originY ?? "50%"
                    const originZ = this.latest.originZ ?? 0
                    element.style.transformOrigin = `${originX} ${originY} ${originZ}`
                })
            }
            computed = this.get("transformOrigin")
        } else if (isCSSVar(key)) {
            render = () => {
                element.style.setProperty(key, this.latest[key] as string)
                this.onUpdate?.()
            }
        } else {
            render = () => {
                element.style[key as any] = this.latest[key] as string
                this.onUpdate?.()
            }
        }

        return this.set(key, value, render, computed, useDefaultValueType)
    }

    private createTransformRender(element: HTMLElement | SVGElement): VoidFunction {
        return () => {
            element.style.transform = this.buildTransformString()
            this.onTransformChange?.()
            this.onUpdate?.()
        }
    }

    protected buildTransformString(): string {
        const template = this.getTransformTemplate?.()

        // Use getLatestValues if available (includes values from VisualElement.latestValues)
        // This ensures transform values from initial/animate are included even if
        // they don't have active MotionValues in the state
        const latestValues = this.getLatestValues?.() ?? this.latest

        let transform = ""
        let transformIsDefault = true
        const transformValues: Record<string, AnyResolvedKeyframe> = {}

        for (let i = 0; i < transformPropOrder.length; i++) {
            const key = transformPropOrder[i]
            const value = latestValues[key]

            if (value === undefined) continue

            let valueIsDefault = true
            if (typeof value === "number") {
                valueIsDefault = value === (key.startsWith("scale") ? 1 : 0)
            } else {
                valueIsDefault = parseFloat(value as string) === 0
            }

            if (!valueIsDefault || template) {
                const valueAsType = getValueAsType(value, numberValueTypes[key])

                if (!valueIsDefault) {
                    transformIsDefault = false
                    const transformName = translateAlias[key] || key
                    transform += `${transformName}(${valueAsType}) `
                }

                if (template) {
                    transformValues[key] = valueAsType
                }
            }
        }

        transform = transform.trim()

        if (template) {
            return template(
                transformValues,
                transformIsDefault ? "" : transform
            )
        }

        return transformIsDefault ? "none" : transform
    }
}
