import { AnyResolvedKeyframe } from "../animation/types"
import { frame } from "../frameloop/frame"
import { Schedule } from "../frameloop/types"
import { MotionValue } from "../value"
import { numberValueTypes } from "../value/types/maps/number"
import { getValueAsType } from "../value/types/utils/get-as-type"

interface Entry {
    value: MotionValue
    render?: VoidFunction
    onRemove: VoidFunction
}

export class MotionValueState {
    latest: { [name: string]: AnyResolvedKeyframe } = {}

    /**
     * Transform keys bound to this state, in `transformPropOrder`. Lets
     * the transform builder visit only bound keys.
     */
    transformKeys?: string[]

    private values = new Map<string, Entry>()

    /**
     * Renders scheduled for the next flush, usually one or two (values
     * bound to the same computed render, e.g. `x` and `y` to `transform`,
     * share an entry). Tracked with a count rather than truncating the
     * array so no backing store is reallocated every frame. Kept per
     * state so pending writes can be flushed synchronously before the
     * subject is measured.
     */
    private pending: VoidFunction[] = []
    private numPending = 0

    /**
     * @param step - The frameloop step renders are scheduled in. Defaults
     * to `frame.render`. Effects that feed a render loop running in
     * `frame.render` (GPU scenes) should write in `frame.preRender`.
     */
    constructor(private step: Schedule = frame.render) {}

    /**
     * @param computed - A value already in this state (e.g. `transform`)
     * whose render should run whenever `value` changes.
     * @param useDefaultValueType - Whether to convert numbers to their
     * default unit when storing in `latest`. Values feeding a computed
     * render can skip this and convert once at render time.
     */
    set(
        name: string,
        value: MotionValue,
        render?: VoidFunction,
        computed?: MotionValue,
        useDefaultValueType = true
    ): VoidFunction {
        this.values.get(name)?.onRemove()

        if (computed) {
            for (const entry of this.values.values()) {
                if (entry.value === computed) render = entry.render
            }
        }

        const onChange = (v: AnyResolvedKeyframe) => {
            this.latest[name] = useDefaultValueType
                ? getValueAsType(v, numberValueTypes[name])
                : v

            render && this.schedule(render)
        }

        onChange(value.get())

        const cancelOnChange = value.on("change", onChange)

        const onRemove = () => {
            cancelOnChange()
            render && !computed && this.cancel(render)
            this.values.delete(name)
        }

        this.values.set(name, {
            value,
            render: computed ? undefined : render,
            onRemove,
        })

        return onRemove
    }

    get(name: string): MotionValue | undefined {
        return this.values.get(name)?.value
    }

    private schedule(render: VoidFunction) {
        const { pending, numPending } = this

        for (let i = 0; i < numPending; i++) {
            if (pending[i] === render) return
        }

        numPending || this.step(this.flush)

        pending[this.numPending++] = render
    }

    private cancel(render: VoidFunction) {
        const { pending } = this

        for (let i = 0; i < this.numPending; i++) {
            if (pending[i] === render) {
                pending[i] = pending[--this.numPending]
                return
            }
        }
    }

    /**
     * Run the pending renders. Resetting the count first means a render
     * scheduled while flushing lands in the next frame, as with the
     * frameloop itself.
     */
    flush = () => {
        const { pending, numPending } = this
        this.numPending = 0
        for (let i = 0; i < numPending; i++) pending[i]()
    }
}
