export const MotionGlobalConfig: {
    skipAnimations?: boolean
    instantAnimations?: boolean
    useManualTiming?: boolean
    WillChange?: any
    mix?: <T>(a: T, b: T) => (p: number) => T
    /**
     * Experimental, on unless set to false: layout animations default to a
     * soft physics spring and start with the element's current velocity
     * (from an interrupted layout animation, or from drag when a layoutId
     * element takes over), with x and y on separate springs.
     */
    layoutVelocity?: boolean
} = {}
