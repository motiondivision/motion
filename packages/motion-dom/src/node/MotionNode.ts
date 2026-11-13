import type { Box } from "motion-utils"
import type { AnyResolvedKeyframe } from "../animation/types"
import type { KeyframeResolver } from "../animation/keyframes/KeyframesResolver"
import { frame } from "../frameloop/frame"
import type { Schedule } from "../frameloop/types"
import { createBox } from "../projection/geometry/models"
import { motionValue, MotionValue } from "../value"
import type { ResolvedValues } from "./types"

/**
 * Binds `key` of `subject` to `node`, by calling `node.set()` with the
 * function that writes it. `value` is undefined for a key that has a
 * latest value but no motion value.
 */
export type BindValue<Subject = any> = (
    subject: Subject,
    node: MotionNode<Subject>,
    key: string,
    value?: MotionValue
) => VoidFunction

/**
 * Reads the current value of `key` from `subject`, as the origin of an
 * animation.
 */
export type ReadValue<Subject = any> = (
    subject: Subject,
    key: string,
    target?: any
) => AnyResolvedKeyframe | null | undefined

export interface NodeBinding {
    render?: VoidFunction
    shared?: boolean
    stop?: VoidFunction
}

const noProps = {}

/**
 * The motion values of one subject (an element, a Three.js object, any
 * object) and the functions that write them to it.
 *
 * Renders are atomic: each key has a function that writes it, and a
 * change to a value schedules only that function. Keys that write the
 * same thing (`x` and `scale` both write `transform`) share a function,
 * which runs once per frame.
 *
 * Every write reads from `latestValues`, so a key can be given a value
 * without a motion value and rendered with `render()`.
 */
export class MotionNode<Subject = any> {
    /**
     * The subject, or null if the node isn't mounted to one yet.
     */
    current: Subject | null = null

    /**
     * The latest value of each key. This is what gets written.
     */
    latestValues: ResolvedValues = {}

    /**
     * The motion values bound to this node.
     */
    values = new Map<string, MotionValue>()

    /**
     * Binds a key to the subject. Set by whatever renders the subject.
     */
    bind?: BindValue<Subject>

    /**
     * Reads a key from the subject.
     */
    read?: ReadValue<Subject>

    /**
     * Write functions shared between keys, by name, e.g. `transform`.
     */
    shared?: { [name: string]: VoidFunction }

    /**
     * Resolves the keyframes of animations on this node's values.
     */
    KeyframeResolver?: typeof KeyframeResolver

    protected bindings = new Map<string, NodeBinding>()

    /**
     * Writes scheduled for the next flush, usually one or two. Tracked
     * with a count rather than truncating the array so no backing store
     * is reallocated every frame.
     */
    private pending: VoidFunction[] = []
    protected numPending = 0

    /**
     * @param step - The frameloop step writes are scheduled in. Defaults
     * to `frame.render`. Nodes that feed a render loop running in
     * `frame.render` (GPU scenes) should write in `frame.preRender`.
     */
    constructor(protected step: Schedule = frame.render) {}

    /**
     * Bind `value` to `name`, writing it with `render` whenever it changes.
     *
     * @param render - Writes to the subject. Reads `latestValues`, or the
     * motion value itself.
     * @param shared - True if other keys schedule `render` too, so it
     * isn't cancelled when this key is removed. Or a value already bound
     * to this node, whose render this key should schedule.
     */
    set(
        name: string,
        value?: MotionValue,
        render?: VoidFunction,
        shared?: MotionValue | boolean
    ): VoidFunction {
        this.unbind(name)

        if (shared && shared !== true) {
            this.values.forEach((bound, key) => {
                if (bound === shared) render = this.bindings.get(key)!.render
            })
        }

        const binding: NodeBinding = { render, shared: Boolean(shared) }
        this.bindings.set(name, binding)

        if (value) {
            this.values.set(name, value)

            /**
             * Values created ahead of a DOM read start out undefined
             * and have nothing to render until they're set.
             */
            const latest = value.get()
            if (latest !== undefined) {
                this.latestValues[name] = latest
                render && !this.isSilent && this.schedule(render)
            }

            binding.stop = value.on("change", (v: AnyResolvedKeyframe) => {
                this.latestValues[name] = v
                this.onChange?.(name)
                render && this.schedule(render)
            })
        } else if (render) {
            this.schedule(render)
        }

        /**
         * Stops writing the key. Its latest value stays, as what was
         * last written to the subject does. A later set() of the same
         * name has already removed this binding, so leave the one that
         * replaced it.
         */
        return () => {
            if (this.bindings.get(name) === binding) {
                this.unbind(name)
                this.values.delete(name)
            }
        }
    }

    /**
     * True while binding values the subject already shows, so binding
     * them writes nothing.
     */
    protected isSilent?: boolean

    /**
     * Called when a bound value changes, before its write is scheduled.
     */
    protected onChange?(name: string): void

    protected unbind(name: string) {
        const binding = this.bindings.get(name)
        if (!binding) return
        binding.stop?.()

        /**
         * A write shared with other keys runs again without this one,
         * e.g. `transform` is written without `x`.
         */
        if (binding.render) {
            binding.shared
                ? this.schedule(binding.render)
                : this.cancel(binding.render)
        }

        this.bindings.delete(name)
    }

    /**
     * Stop listening to every value, keeping the values themselves, as
     * when the subject is removed and may come back.
     */
    protected unbindAll() {
        this.bindings.forEach((binding) => binding.stop?.())
        this.bindings.clear()
        this.shared = undefined
        this.numPending = 0
    }

    get(name: string): MotionValue | undefined {
        return this.values.get(name)
    }

    hasValue(name: string) {
        return this.values.has(name)
    }

    /**
     * Bind a key to the subject, with the motion value it has, if any.
     */
    protected bindValue(name: string, value?: MotionValue) {
        this.bind
            ? this.bind(this.current!, this, name, value)
            : this.set(name, value)
    }

    /**
     * Add a motion value and bind it to the subject, if there is one.
     * A value that starts undefined (it's read from the subject when it
     * animates) leaves the key's latest value in place.
     */
    addValue(name: string, value: MotionValue) {
        if (value === this.values.get(name)) return
        this.unbind(name)
        this.values.set(name, value)

        const latest = value.get()
        if (latest !== undefined) this.latestValues[name] = latest

        this.current && this.bindValue(name, value)
    }

    /**
     * Remove a motion value and what binds it to the subject.
     */
    removeValue(name: string) {
        this.unbind(name)
        this.values.delete(name)
        delete this.latestValues[name]
    }

    /**
     * Get the motion value for a key. If called with a default value,
     * one is made if none exists.
     */
    getValue(name: string): MotionValue | undefined
    getValue(name: string, defaultValue: AnyResolvedKeyframe | null): MotionValue
    getValue(
        name: string,
        defaultValue?: AnyResolvedKeyframe | null
    ): MotionValue | undefined {
        let value = this.values.get(name)

        if (value === undefined && defaultValue !== undefined) {
            value = motionValue(defaultValue ?? this.getDefaultValue?.(name), {
                owner: this,
            })
            this.addValue(name, value)
        }

        return value
    }

    /**
     * The value getValue starts a new motion value from when it isn't
     * given a default. Without it, values start unread and the keyframe
     * resolver reads their origin.
     */
    getDefaultValue?(name: string): AnyResolvedKeyframe | undefined

    /**
     * The current value of a key, read from the subject if the node has
     * never been given one.
     */
    readValue(name: string, target?: any): any {
        return (
            this.latestValues[name] ??
            (this.current
                ? this.read?.(this.current, name, target)
                : undefined)
        )
    }

    getStaticValue(name: string) {
        return this.latestValues[name]
    }

    /**
     * Set the latest value of a key without a motion value. It's written
     * by the next render.
     */
    setStaticValue(name: string, value: AnyResolvedKeyframe) {
        this.latestValues[name] = value
    }

    /**
     * Detach every value from this node and return them, so another
     * node can take them over.
     */
    release() {
        const values = new Map(this.values)
        values.forEach((_, name) => this.removeValue(name))
        this.shared = undefined
        this.numPending = 0
        return values
    }

    protected queue(render: VoidFunction) {
        const { pending, numPending } = this

        for (let i = 0; i < numPending; i++) {
            if (pending[i] === render) return
        }

        pending[this.numPending++] = render
    }

    /**
     * `immediate`, so a write scheduled by something else in the same
     * frameloop step is flushed in this frame.
     */
    private schedule(render: VoidFunction) {
        this.numPending || this.step(this.flush, false, true)
        this.queue(render)
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
     * True if the next flush was asked for with scheduleRender() or
     * render(), so runs afterRender() even with nothing to write.
     */
    private isForced = false

    /**
     * Run the pending writes. Resetting the count first means a write
     * scheduled while flushing lands in the next frame, as with the
     * frameloop itself.
     */
    flush = () => {
        const { pending, numPending, isForced } = this
        this.numPending = 0
        this.isForced = false
        for (let i = 0; i < numPending; i++) pending[i]()
        ;(numPending || isForced) && this.afterRender?.()
        this.numPending && this.step(this.flush)
    }

    /**
     * Called after a flush that wrote something, or was asked for.
     */
    protected afterRender?(): void

    protected queueAll() {
        /**
         * Bind keys that have a latest value but no motion value.
         */
        if (this.current) {
            for (const key in this.latestValues) {
                this.bindings.has(key) || this.bindValue(key)
            }
        }

        this.bindings.forEach(this.queueBinding)
        this.isForced = true
    }

    /**
     * A value that hasn't been read from the subject yet has nothing
     * to write, and writing first could change what is read.
     */
    private queueBinding = ({ render }: NodeBinding, name: string) => {
        render && this.latestValues[name] !== undefined && this.queue(render)
    }

    /**
     * Schedule every key to be written in the next frame.
     */
    scheduleRender = () => {
        this.isForced || this.step(this.flush, false, true)
        this.queueAll()
    }

    /**
     * Write every key now, e.g. so the subject can be measured.
     */
    render = () => {
        if (!this.current) return
        this.queueAll()
        this.flush()
    }

    measureViewportBox(): Box {
        return createBox()
    }

    getProps(): any {
        return noProps
    }
}
