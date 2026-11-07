/**
 * An update function. It accepts a timestamp used to advance the animation.
 */
type Update = (timestamp: number) => void

/**
 * Drivers accept a update function and call it at an interval. This interval
 * could be a synchronous loop, a setInterval, or tied to the device's framerate.
 */
export interface DriverControls {
    start: (keepAlive?: boolean) => void
    stop: () => void
    now: () => number
    /**
     * Stop updating every frame, after one more update, until started
     * again. Without it, a driver is stopped and updated once.
     */
    hold?: () => void
    /**
     * A blend the driver can run itself each frame, without calling its
     * update, until the time leaves the blend or the driver is started,
     * held or stopped.
     */
    lane?: DriverLane
}

export interface DriverLane {
    /**
     * Start time, and the blend's start and end times after it, in ms.
     */
    startTime: number
    from: number
    to: number
    /**
     * Blend between `origin` and `origin + delta`.
     */
    origin: number
    delta: number
    ease: (t: number) => number
    /**
     * Time written back each frame, as time since the delay.
     */
    delay: number
    write: (latest: number, currentTime: number) => void
}

export type Driver = (update: Update) => DriverControls
