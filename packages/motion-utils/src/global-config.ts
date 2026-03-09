export const MotionGlobalConfig: {
    skipAnimations?: boolean
    instantAnimations?: boolean
    useManualTiming?: boolean
    frameRate?: number
    WillChange?: any
    mix?: <T>(a: T, b: T) => (p: number) => T
} = {}
