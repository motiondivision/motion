import { addUniqueItem, removeItem } from "./array"

type GenericHandler = (...args: any) => void

export class SubscriptionManager<Handler extends GenericHandler> {
    private subscriptions: Handler[] = []

    add(handler: Handler): VoidFunction {
        addUniqueItem(this.subscriptions, handler)
        return () => removeItem(this.subscriptions, handler)
    }

    notify(
        a?: Parameters<Handler>[0],
        b?: Parameters<Handler>[1],
        c?: Parameters<Handler>[2]
    ) {
        const numSubscriptions = this.subscriptions.length

        if (!numSubscriptions) return

        if (numSubscriptions === 1) {
            /**
             * If there's only a single handler we can just call it without invoking a loop.
             */
            this.subscriptions[0](a, b, c)
        } else {
            for (let i = 0; i < numSubscriptions; i++) {
                /**
                 * Check whether the handler exists before firing as it's possible
                 * the subscriptions were modified during this loop running.
                 */
                const handler = this.subscriptions[i]
                handler && handler(a, b, c)
            }
        }
    }

    getSize() {
        return this.subscriptions.length
    }

    clear() {
        this.subscriptions.length = 0
    }
}
