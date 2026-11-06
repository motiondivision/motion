import { frame } from "../frameloop/frame"
import { Schedule } from "../frameloop/types"
import { MotionValue } from "../value"

interface Entry {
    value: MotionValue
    render?: VoidFunction
    /**
     * Schedules the render. Values bound to the same computed render
     * share one, so each bound value holds no function of its own.
     */
    onChange: VoidFunction
}

export class MotionValueState {
    /**
     * Transform keys bound to this state, in `transformPropOrder`, and
     * the value bound to each. Lets the transform builder visit only
     * bound transforms, reading each value directly.
     */
    transformKeys?: string[]
    transformValues?: Record<string, MotionValue>

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
     * @param render - Writes the value to the subject. Renders read the
     * motion value directly rather than a cached copy, so there is one
     * place a value lives.
     * @param computed - A value already in this state (e.g. `transform`)
     * whose render should run whenever `value` changes.
     */
    set(
        name: string,
        value: MotionValue,
        render?: VoidFunction,
        computed?: MotionValue
    ): VoidFunction {
        this.remove(name)

        let onChange: VoidFunction | undefined
        let isBound = false

        if (computed) {
            for (const entry of this.values.values()) {
                if (entry.value === computed) {
                    render = entry.render
                    onChange = entry.onChange
                }
                if (entry.value === value) isBound = true
            }
        }

        /**
         * A value bound under two names subscribes once for each, so it
         * can't share its computed value's subscriber.
         */
        if (!onChange || isBound) {
            onChange = () => render && this.schedule(render)
        }

        /**
         * Values created ahead of a DOM read start out undefined and
         * have nothing to render until they're set.
         */
        value.get() !== undefined && onChange()

        value.addChangeSubscriber(onChange)

        this.values.set(name, {
            value,
            render: computed ? undefined : render,
            onChange,
        })

        return () => this.remove(name, value)
    }

    /**
     * Unbind a value, if it's the one bound to this name.
     */
    remove(name: string, value?: MotionValue) {
        const entry = this.values.get(name)
        if (!entry || (value && entry.value !== value)) return

        entry.value.removeChangeSubscriber(entry.onChange)
        entry.render && this.cancel(entry.render)
        this.values.delete(name)
    }

    get(name: string): MotionValue | undefined {
        return this.values.get(name)?.value
    }

    /**
     * Detach every value from this state and return them, so another
     * renderer can take them over. The state stays cached by its effect,
     * so the bound transforms are reset too rather than leaking into
     * values bound later.
     */
    release() {
        const values = new Map<string, MotionValue>()
        this.values.forEach((entry, name) => {
            values.set(name, entry.value)
            this.remove(name)
        })
        this.transformKeys = this.transformValues = undefined
        return values
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
