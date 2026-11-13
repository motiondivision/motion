import {
    AnyResolvedKeyframe,
    UnresolvedValueKeyframe,
} from "../../animation/types"
import { Schedule } from "../../frameloop/types"
import { MotionNode } from "../../node/MotionNode"
import { MotionValue } from "../../value"

/**
 * Returns true if the effect knows how to write to `subject`.
 */
export type EffectTest<Subject extends object> = (
    subject: unknown
) => subject is Subject

/**
 * Reads the current value of `key` from `subject`, used as the initial
 * keyframe when `animate()` creates a motion value for the subject.
 * Returns `undefined` when the value can't be read.
 *
 * `keyframes` is the target being animated to, so effects can match
 * the format of the initial value (for instance color vs numeric).
 */
export type EffectRead<Subject extends object> = (
    subject: Subject,
    key: string,
    keyframes?: UnresolvedValueKeyframe | UnresolvedValueKeyframe[]
) => AnyResolvedKeyframe | undefined

export interface EffectOptions<Subject extends object> {
    test?: EffectTest<Subject>
    read?: EffectRead<Subject>

    /**
     * Frameloop step writes are scheduled in. Defaults to `frame.render`.
     */
    step?: Schedule

    /**
     * Where the effect keeps the node of each subject. Effects that
     * render the same kind of subject share a store, so they share its
     * values. Defaults to a store of the effect's own.
     */
    nodes?: WeakMap<object, MotionNode>
}

export interface Effect<Subject extends object = object>
    extends EffectOptions<Subject> {
    (subject: Subject, values: Record<string, MotionValue>): VoidFunction

    /**
     * Returns the motion value currently bound to `key` on `subject`, if any.
     */
    get(subject: Subject, key: string): MotionValue | undefined

    /**
     * Write `subject`'s pending values now rather than in the next frame,
     * e.g. so it can be measured with a target applied.
     */
    flush(subject: Subject): void

    /**
     * The node holding the motion values bound to `subject`, if any have
     * been.
     */
    state(subject: Subject): MotionNode<Subject> | undefined

    /**
     * The node for `subject`, made if it has none.
     */
    node(subject: Subject): MotionNode<Subject>
}

/**
 * An effect that can be registered with `animate.addEffect()`.
 */
export interface AnimateEffect<Subject extends object = object>
    extends Effect<Subject> {
    test: EffectTest<Subject>
    read: EffectRead<Subject>
}

export type AddEffectValue<Subject extends object> = (
    subject: Subject,
    state: MotionNode<Subject>,
    key: string,
    value: MotionValue
) => VoidFunction

export function createEffect<Subject extends object>(
    addValue: AddEffectValue<Subject>,
    options: EffectOptions<Subject> & {
        test: EffectTest<Subject>
        read: EffectRead<Subject>
    }
): AnimateEffect<Subject>
export function createEffect<Subject extends object>(
    addValue: AddEffectValue<Subject>,
    options?: EffectOptions<Subject>
): Effect<Subject>
export function createEffect<Subject extends object>(
    addValue: AddEffectValue<Subject>,
    { step, nodes, ...options }: EffectOptions<Subject> = {}
): Effect<Subject> {
    const own = new WeakMap<Subject, MotionNode<Subject>>()

    /**
     * A subject in a shared store can be owned by another effect's
     * node, which writes its keys differently. This effect then keeps
     * its own.
     */
    const state = (subject: Subject) => {
        const node = nodes?.get(subject)
        return node?.bind === addValue ? node : own.get(subject)
    }

    const getNode = (subject: Subject) => {
        let node = state(subject)

        if (!node) {
            node = new MotionNode<Subject>(step)
            node.current = subject
            node.bind = addValue as MotionNode<Subject>["bind"]
            node.read = options.read
            ;(nodes && !nodes.has(subject) ? nodes : own).set(subject, node)
        }

        return node
    }

    const effect = (
        subject: Subject,
        values: Record<string, MotionValue>
    ): VoidFunction => {
        const node = getNode(subject)
        const subscriptions: VoidFunction[] = []

        for (const key in values) {
            subscriptions.push(addValue(subject, node, key, values[key]))
        }

        return () => {
            for (const cancel of subscriptions) cancel()
        }
    }

    return Object.assign(effect, options, {
        get: (subject: Subject, key: string) => state(subject)?.get(key),
        flush: (subject: Subject) => state(subject)?.flush(),
        state,
        node: getNode,
    })
}
