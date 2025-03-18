import { removeItem } from "motion-utils"
import type { ViewTransitionBuilder } from "."
import { microtask } from "../frameloop/microtask"
import { startViewAnimation } from "./start"

interface ViewAnimationQueue {
    builders: ViewTransitionBuilder[]
    add: (builder: ViewTransitionBuilder) => void
    next: () => void
    start: (builder: ViewTransitionBuilder) => void
    processQueue: () => void
}

export const queue: ViewAnimationQueue = {
    builders: [],

    add(builder: ViewTransitionBuilder) {
        queue.builders.push(builder)
        microtask.render(queue.processQueue)
    },

    processQueue() {
        /**
         * Iterate backwards over the builders array. We can ignore the
         * "wait" animations. If we have an interrupting animation in the
         * queue then we need to batch all preceeding animations into it.
         * Currently this only batches the update functions but will also
         * need to batch the targets.
         */
        for (let i = queue.builders.length - 1; i >= 0; i--) {
            const builder = queue.builders[i]
            const { interrupt } = builder.options

            if (interrupt === "immediate") {
                const batched = queue.builders
                    .slice(0, i + 1)
                    .map((b) => b.update)
                const remaining = queue.builders.slice(i + 1)

                builder.update = () => {
                    batched.forEach(triggerUpdate)
                }

                // Put the current builder at the front, followed by any "wait" builders
                queue.builders = [builder, ...remaining]

                break
            }
        }

        // TODO Only trigger next if there's not a currently running animation
        // unless we're interrupting one
        queue.next()
    },

    next() {
        const [nextBuilder] = queue.builders
        if (nextBuilder) queue.start(nextBuilder)
    },

    start(builder: ViewTransitionBuilder) {
        removeItem(queue.builders, builder)
        startViewAnimation(builder).then((animation) => {
            builder.notifyReady(animation)
            animation.finished.then(() => {
                queue.next()
            })
        })
    },
}

function triggerUpdate(update: VoidFunction) {
    update()
}
