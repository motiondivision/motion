import { MotionGlobalConfig } from "motion-utils"
import { recordStats } from ".."
import { frame, frameData } from "../../frameloop"

MotionGlobalConfig.useManualTiming = true

describe("recordStats", () => {
    it("should throw an error if stats are already being measured", () => {
        expect(() => {
            recordStats()
            recordStats()
        }).toThrow()
    })

    it("should return the correct stats", async () => {
        return new Promise<void>((resolve) => {
            const record = recordStats()

            frameData.timestamp = 15
            frameData.delta = 1000 / 60

            frame.update(() => {})

            frame.render(() => {
                queueMicrotask(() => {
                    const stats = record()

                    const {
                        rate,
                        read,
                        resolveKeyframes,
                        update,
                        preRender,
                        render,
                        postRender,
                    } = stats.frameloop

                    expect(rate.min).toEqual(60)
                    expect(rate.max).toEqual(60)
                    expect(rate.avg).toEqual(60)
                    expect(read.min).toEqual(0)
                    expect(read.max).toEqual(0)
                    expect(read.avg).toEqual(0)
                    expect(resolveKeyframes.min).toEqual(0)
                    expect(resolveKeyframes.max).toEqual(0)
                    expect(resolveKeyframes.avg).toEqual(0)
                    expect(update.min).toEqual(1)
                    expect(update.max).toEqual(1)
                    expect(update.avg).toEqual(1)
                    expect(preRender.min).toEqual(0)
                    expect(preRender.max).toEqual(0)
                    expect(preRender.avg).toEqual(0)
                    expect(render.min).toEqual(1)
                    expect(render.max).toEqual(1)
                    expect(render.avg).toEqual(1)

                    // postRender always at least 1 as stats itself uses a postRender step
                    expect(postRender.min).toEqual(1)
                    expect(postRender.max).toEqual(1)
                    expect(postRender.avg).toEqual(1)

                    resolve()
                })
            })
        })
    })

    it("should return the correct stats across multiple frames", async () => {
        return new Promise<void>((resolve) => {
            const record = recordStats()

            frameData.timestamp = 15
            frameData.delta = 1000 / 60

            frame.update(() => {})

            frame.render(() => {})

            frame.postRender(() => {
                frameData.timestamp = 30
                frameData.delta = 1000 / 30

                frame.update(() => {})
                frame.update(() => {})
                frame.update(() => {})
                frame.render(() => {
                    queueMicrotask(() => {
                        const stats = record()

                        const {
                            rate,
                            read,
                            resolveKeyframes,
                            update,
                            preRender,
                            render,
                            postRender,
                        } = stats.frameloop

                        expect(rate.min).toEqual(30)
                        expect(rate.max).toEqual(60)
                        expect(rate.avg).toEqual(40)
                        expect(read.min).toEqual(0)
                        expect(read.max).toEqual(0)
                        expect(read.avg).toEqual(0)
                        expect(resolveKeyframes.min).toEqual(0)
                        expect(resolveKeyframes.max).toEqual(0)
                        expect(resolveKeyframes.avg).toEqual(0)
                        expect(update.min).toEqual(1)
                        expect(update.max).toEqual(3)
                        expect(update.avg).toEqual(2)
                        expect(preRender.min).toEqual(0)
                        expect(preRender.max).toEqual(0)
                        expect(preRender.avg).toEqual(0)
                        expect(render.min).toEqual(1)
                        expect(render.max).toEqual(1)
                        expect(render.avg).toEqual(1)

                        // postRender always at least 1 as stats itself uses a postRender step
                        expect(postRender.min).toEqual(1)
                        expect(postRender.max).toEqual(2)
                        expect(postRender.avg).toEqual(1.5)

                        resolve()
                    })
                })
            })
        })
    })
})
