import { frame, cancelFrame, frameSteps, frameData } from ".."

describe("frame", () => {
    it("fires callbacks in the correct order", () => {
        return new Promise<void>((resolve, reject) => {
            const order: number[] = []

            frame.read(() => order.push(0))
            frame.update(() => order.push(1))
            frame.preRender(() => order.push(2))
            frame.render(() => order.push(3))
            frame.postRender(() => {
                order.push(4)
                if (
                    order[0] === 0 &&
                    order[1] === 1 &&
                    order[2] === 2 &&
                    order[3] === 3 &&
                    order[4] === 4
                ) {
                    resolve()
                } else {
                    reject(order)
                }
            })
        })
    })

    it("cancels callbacks", () => {
        return new Promise<void>((resolve, reject) => {
            let hasFired = false

            const process = frame.render(() => (hasFired = true))

            frame.update(() => cancelFrame(process))

            frame.postRender(() => (hasFired ? reject(hasFired) : resolve()))
        })
    })

    it("fires callback on current frame if scheduled with `true` within the same step", () => {
        return new Promise<number | string | void>((resolve, reject) => {
            let v = 0

            frame.update(({ timestamp: prevTimestamp }) => {
                v++
                frame.update(
                    ({ timestamp }) => {
                        v++
                        if (timestamp !== prevTimestamp) {
                            reject(`${timestamp} ${prevTimestamp}`)
                        }
                    },
                    false,
                    true
                )
            })

            frame.render(() => (v === 2 ? resolve() : reject(v)))
        })
    })

    it("fires callback on next frame if scheduled with `true` outside the same step", () => {
        return new Promise((resolve: Function, reject: Function) => {
            let v = 0

            frame.update(() => v++)
            frame.update(() => v++, false, true)
            frame.render(() => (v === 2 ? resolve() : reject()))
        })
    })

    it("uses default elapsed time if first fire", () => {
        return new Promise((resolve: Function, reject: Function) => {
            frame.update(({ delta: defaultElapsed }) => {
                setTimeout(
                    () =>
                        frame.update(({ delta }) =>
                            delta === defaultElapsed
                                ? resolve()
                                : reject(defaultElapsed, delta)
                        ),
                    50
                )
            })
        })
    })

    it("correctly cancels", () => {
        return new Promise<void>((resolve, reject) => {
            const callback = () => reject()

            frame.read(() => cancelFrame(callback))
            frame.update(callback)
            frame.render(() => resolve())
        })
    })

    it("correctly keeps alive", () => {
        return new Promise<void>((resolve) => {
            let v = 0
            frame.update(() => v++, true)
            frame.render(() => v === 2 && resolve(), true)
        })
    })

    it("correctly cancels a keepAlive process", () => {
        return new Promise<number[] | void>((resolve, reject) => {
            let updateCount = 0
            let renderCount = 0

            const update = frame.update(() => {
                updateCount++

                if (updateCount === 4) cancelFrame(update)
            }, true)

            frame.render(() => {
                renderCount++

                if (renderCount === 6) {
                    if (renderCount !== updateCount) {
                        resolve()
                    } else {
                        reject([renderCount, updateCount])
                    }
                }
            }, true)
        })
    })

    it("correctly keeps alive after a flush", async () => {
        const promise = new Promise<boolean>((resolve) => {
            let v = 0

            frame.update(() => {
                if (v === 2) frameSteps.update.process(frameData)
            }, true)

            frame.update(() => {
                v++
                if (v > 6) resolve(true)
            }, true)
        })
        frameSteps.update.process(frameData)
        return expect(promise).resolves.toBe(true)
    })
})
