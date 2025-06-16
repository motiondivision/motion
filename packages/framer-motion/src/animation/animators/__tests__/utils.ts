import { frameData, time } from "motion-dom"

export const syncDriver = (interval = 10) => {
    time.set(0)

    const driver = (update: (v: number) => void) => {
        let isRunning = true
        let elapsed = 0

        frameData.isProcessing = true
        frameData.delta = interval
        frameData.timestamp = elapsed

        return {
            start: () => {
                isRunning = true
                setTimeout(() => {
                    time.set(elapsed)
                    update(elapsed)
                    while (isRunning) {
                        elapsed += interval
                        time.set(elapsed)
                        update(elapsed)
                    }
                }, 0)
            },
            stop: () => {
                frameData.isProcessing = false
                isRunning = false
            },
            now: () => elapsed,
        }
    }

    return driver
}
