/**
 * Minimal driver interface for global config.
 * The full Driver type is in motion-dom.
 */
interface GlobalDriver {
    (update: (timestamp: number) => void): {
        start: (keepAlive?: boolean) => void
        stop: () => void
        now: () => number
    }
}

export const MotionGlobalConfig: {
    skipAnimations?: boolean
    instantAnimations?: boolean
    WillChange?: any
    mix?: <T>(a: T, b: T) => (p: number) => T
    /**
     * Custom animation driver. When set, WAAPI is disabled
     * and all animations use this driver for timing.
     */
    driver?: GlobalDriver
} = {}
