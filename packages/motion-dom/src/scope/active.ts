import type { AnimationOptions } from "../animation/types"

/**
 * The scope that `animate()`, `scroll()`, `inView()`, gestures and
 * `resize()` register their cleanups with while it runs. Set by
 * `scopeMotion()`.
 */
export interface ActiveScope {
    root?: Element
    transition?: AnimationOptions
    add(cleanup: VoidFunction): VoidFunction
    bind<F extends (...args: any[]) => any>(callback: F): F
    track(element: Element): void
}

export const activeScope: { current?: ActiveScope } = {}

/**
 * Register `cleanup` with the active scope, if there is one, so stopping
 * the scope also runs it.
 */
export function addToScope<T extends VoidFunction>(cleanup: T): T {
    activeScope.current?.add(cleanup)
    return cleanup
}

/**
 * Collect the animation a builder like `animateLayout()` or
 * `animateView()` resolves with. If the scope stops first, the animation
 * is stopped as soon as it starts.
 */
export function addBuilderToScope(builder: {
    then(resolve: (animation?: any) => void, reject?: () => void): unknown
}) {
    const scope = activeScope.current
    if (!scope) return

    let isStopped = false
    let stop: VoidFunction | undefined
    const remove = scope.add(() => {
        isStopped = true
        stop?.()
    })

    builder.then((animation?: { stop(): void; finished: Promise<any> }) => {
        if (!animation) return
        stop = () => animation.stop()
        isStopped ? stop() : animation.finished.then(remove)
    }, remove)
}

/**
 * Bind `callback` to the active scope, so anything it starts later (for
 * instance an animation in an `inView()` callback) is collected too.
 */
export const bindToScope = <F extends (...args: any[]) => any>(callback: F) =>
    activeScope.current ? activeScope.current.bind(callback) : callback
