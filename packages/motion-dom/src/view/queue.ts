import { removeItem } from "motion-utils"
import type { ViewTransitionBuilder } from "."
import { microtask } from "../frameloop/microtask"
import { startViewAnimation } from "./start"

let builders: ViewTransitionBuilder[] = []

let current: ViewTransitionBuilder | null = null

function next() {
    current = null
    const [nextBuilder] = builders
    if (nextBuilder) start(nextBuilder)
}

function start(builder: ViewTransitionBuilder) {
    removeItem(builders, builder)
    current = builder
    startViewAnimation(builder).then((animation) => {
        builder.notifyReady(animation)
        animation.finished.finally(next)
    })
}

function processQueue() {
    /**
     * Iterate backwards over the builders array. We can ignore the
     * "wait" animations. If we have an interrupting animation in the
     * queue then we need to batch all preceeding animations into it.
     * Currently this only batches the update functions but will also
     * need to batch the targets.
     */
    for (let i = builders.length - 1; i >= 0; i--) {
        const builder = builders[i]
        const { interrupt } = builder.options

        if (interrupt === "immediate") {
            const batchedUpdates = builders.slice(0, i + 1).map((b) => b.update)
            const remaining = builders.slice(i + 1)

            builder.update = () => {
                batchedUpdates.forEach((update) => update())
            }

            // Put the current builder at the front, followed by any "wait" builders
            builders = [builder, ...remaining]

            break
        }
    }

    if (!current || builders[0]?.options.interrupt === "immediate") {
        next()
    }
}

export function addToQueue(builder: ViewTransitionBuilder) {
    builders.push(builder)
    microtask.render(processQueue)
}
