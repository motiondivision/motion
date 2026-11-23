export type MockIntersectionObserverEntry = {
    isIntersecting: boolean
    target: Element
}

export type MockIntersectionObserverCallback = (
    entries: MockIntersectionObserverEntry[]
) => void

let activeIntersectionObserver: MockIntersectionObserverCallback | undefined

export const getActiveObserver = () => activeIntersectionObserver

window.IntersectionObserver = class MockIntersectionObserver {
    callback: MockIntersectionObserverCallback

    constructor(callback: MockIntersectionObserverCallback) {
        this.callback = callback
    }

    observe(element: Element) {
        /**
         * Report entries for the observed element, as observers only hear
         * about the elements they observe.
         */
        activeIntersectionObserver = (entries) =>
            this.callback(
                entries.map((entry) => ({ ...entry, target: element }))
            )
    }

    unobserve(_element: Element) {
        activeIntersectionObserver = undefined
    }

    disconnect() {
        activeIntersectionObserver = undefined
    }
} as any
