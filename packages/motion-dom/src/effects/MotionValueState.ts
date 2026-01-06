import { AnyResolvedKeyframe } from "../animation/types"
import { cancelFrame, frame } from "../frameloop/frame"
import { MotionValue } from "../value"
import { numberValueTypes } from "../value/types/maps/number"
import { getValueAsType } from "../value/types/utils/get-as-type"

export interface MotionValueStateOptions {
    onValueChange?: (key: string, value: AnyResolvedKeyframe) => void
    /**
     * Whether to apply default value types (e.g., adding "px" to numeric values).
     * Set to false for non-DOM targets like plain objects.
     */
    useDefaultValueType?: boolean
}

export class MotionValueState {
    latest: { [name: string]: AnyResolvedKeyframe } = {}
    protected onValueChangeCallback?: (
        key: string,
        value: AnyResolvedKeyframe
    ) => void
    protected defaultUseValueType: boolean

    protected values = new Map<
        string,
        { value: MotionValue; onRemove: VoidFunction }
    >()

    constructor(options?: MotionValueStateOptions) {
        this.onValueChangeCallback = options?.onValueChange
        this.defaultUseValueType = options?.useDefaultValueType ?? true
    }

    set(
        name: string,
        value: MotionValue,
        render?: VoidFunction,
        computed?: MotionValue,
        useDefaultValueType?: boolean
    ) {
        const existingValue = this.values.get(name)

        if (existingValue) {
            existingValue.onRemove()
        }

        // Use the passed value if explicitly set, otherwise use the class default
        const shouldUseDefaultValueType =
            useDefaultValueType ?? this.defaultUseValueType

        let prevValue: AnyResolvedKeyframe | undefined

        const onChange = (isInitial = false) => {
            const v = value.get()

            // Track typed value for comparison
            const typedValue = shouldUseDefaultValueType
                ? getValueAsType(v, numberValueTypes[name])
                : v

            // Skip if value hasn't actually changed (prevents duplicate callbacks)
            if (!isInitial && typedValue === prevValue) {
                return
            }

            this.latest[name] = typedValue
            prevValue = typedValue

            // Only process changes for actual value updates, not initial setup
            // This prevents spurious onUpdate calls when values are first added
            if (!isInitial) {
                // Allow subclasses to hook into value changes
                // Pass the raw value, not the typed value, for latestValues sync
                this.onValueChange(name, v)
                render && frame.render(render)
            }
        }

        // Initialize latest value without triggering change callbacks
        onChange(true)

        const cancelOnChange = value.on("change", () => onChange())

        computed && value.addDependent(computed)

        const remove = () => {
            cancelOnChange()
            render && cancelFrame(render)
            this.values.delete(name)
            computed && value.removeDependent(computed)
        }

        this.values.set(name, { value, onRemove: remove })

        return remove
    }

    /**
     * Called when any value changes. Override in subclasses to hook into changes.
     */
    protected onValueChange(name: string, value: AnyResolvedKeyframe): void {
        // Call optional callback if provided
        this.onValueChangeCallback?.(name, value)
    }

    get(name: string): MotionValue | undefined {
        return this.values.get(name)?.value
    }

    destroy() {
        for (const value of this.values.values()) {
            value.onRemove()
        }
    }

    forEach(callback: (value: MotionValue, key: string) => void) {
        for (const [key, entry] of this.values) {
            callback(entry.value, key)
        }
    }

    getStatic(): Record<string, AnyResolvedKeyframe> {
        return { ...this.latest }
    }
}
