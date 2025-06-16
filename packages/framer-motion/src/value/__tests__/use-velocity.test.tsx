import { frame, frameData, frameSteps, time } from "motion-dom"
import { mirrorEasing, MotionGlobalConfig } from "motion-utils"
import { useEffect } from "react"
import { animate } from "../../animation/animate"
import { render } from "../../jest.setup"
import { useMotionValueEvent } from "../../utils/use-motion-value-event"
import { useMotionValue } from "../use-motion-value"
import { useVelocity } from "../use-velocity"

MotionGlobalConfig.useManualTiming = true

const setFrameData = (interval: number, newTime: number) => {
    time.set(newTime)
    frameData.timestamp = newTime
    frameData.delta = interval
}

const syncDriver =
    (interval = 10) =>
    (update: (v: number) => void) => {
        let isRunning = true
        let elapsed = 0

        return {
            start: () => {
                setTimeout(() => {
                    update(elapsed)
                    while (isRunning) {
                        elapsed += interval
                        setFrameData(interval, elapsed)
                        update(elapsed)
                        frameSteps.update.process(frameData)
                    }
                }, 0)
            },
            stop: () => (isRunning = false),
            now: () => elapsed,
        }
    }

describe("useVelocity", () => {
    test("creates a motion value that updates with the velocity of the provided motion value", async () => {
        const output: number[] = []
        const outputVelocity: number[] = []
        const outputAcceleration: number[] = []

        const promise = new Promise((resolve) => {
            const Component = () => {
                time.set(0)

                const x = useMotionValue(0)
                const xVelocity = useVelocity(x)
                const xAcceleration = useVelocity(xVelocity)

                useMotionValueEvent(x, "change", (v) =>
                    output.push(Math.round(v))
                )
                useMotionValueEvent(xVelocity, "change", (v) => {
                    outputVelocity.push(Math.round(v))
                })
                useMotionValueEvent(xAcceleration, "change", (v) => {
                    outputAcceleration.push(Math.round(v))
                })

                useEffect(() => {
                    const animation = animate(x, 1000, {
                        duration: 0.1,
                        ease: mirrorEasing((v) => v * v),
                        driver: syncDriver(),
                        onComplete: () => {
                            /**
                             * This stack is basically waiting x frames to allow
                             * the derived values to "settle", as when a motion value
                             * is set it sets a velocity check for the end of the following frame.
                             * The more derivatives we have the more frames it'll take for
                             * all values to settle.
                             */
                            frameData.timestamp = 110
                            frameSteps.update.process(frameData)
                            frame.postRender(() => {
                                frameData.timestamp = 120
                                frameSteps.update.process(frameData)
                                frame.postRender(() => {
                                    frameData.timestamp = 130
                                    frameSteps.update.process(frameData)
                                    frame.postRender(() => {
                                        frameData.timestamp = 140
                                        frameSteps.update.process(frameData)
                                        frame.postRender(() => {
                                            frameData.timestamp = 150
                                            frameSteps.update.process(frameData)
                                            resolve(undefined)
                                        })
                                    })
                                })
                            })
                        },
                    } as any)

                    return () => {
                        animation.stop()
                    }
                }, [])

                return null
            }

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        await promise
        expect(output).toEqual([
            20, 80, 180, 320, 500, 680, 820, 920, 980, 1000,
        ])
        expect(outputVelocity).toEqual([
            2000, 6000, 10000, 14000, 18000, 18000, 14000, 10000, 6000, 2000, 0,
        ])
        expect([
            outputAcceleration[0],
            outputAcceleration[1],
            outputAcceleration[2],
        ]).toEqual([200000, 400000, 400000])
    })
})
