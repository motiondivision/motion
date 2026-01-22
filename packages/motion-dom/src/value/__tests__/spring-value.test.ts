import { syncDriver } from "../../animation/__tests__/utils"
import { motionValue } from "../index"
import { attachSpring, springValue } from "../spring-value"

describe("springValue types", () => {
    test("can create a motion value from a number", () => {
        const x = springValue(100)
        expect(x.get()).toBe(100)
    })

    test("can create a motion value from a string with a unit", () => {
        const x = springValue("100%")
        expect(x.get()).toBe("100%")
    })

    test("can create a motion value from a number motion value", () => {
        const source = motionValue(100)
        const x = springValue(source)
        expect(x.get()).toBe(100)
    })

    test("can create a motion value from a string motion value with a unit", () => {
        const source = motionValue("100%")
        const x = springValue(source)
        expect(x.get()).toBe("100%")
    })
})

const runSpringTests = (unit?: string | undefined) => {
    const createValue = (num: number) => {
        if (unit) {
            return `${num}${unit}` as unknown as number
        }
        return num as number
    }

    const parseTestValue = (val: string | number): number =>
        typeof val === "string" ? parseFloat(val) : val

    const formatOutput = (num: number) => {
        if (unit) {
            return `${Math.round(num)}${unit}`
        }
        return Math.round(num)
    }

    describe(`springValue ${unit ? `with ${unit}` : "with numbers"}`, () => {
        test("can create a motion value from a number", async () => {
            const promise = new Promise((resolve) => {
                const x = motionValue(createValue(0))
                const spring = springValue(x)

                spring.on("change", (v) => resolve(v))
                x.set(createValue(100))
            })

            const resolved = await promise

            expect(resolved).not.toBe(createValue(0))
            expect(resolved).not.toBe(createValue(100))
        })

        test("can create a MotionValue that responds to changes from another MotionValue", async () => {
            const promise = new Promise((resolve) => {
                const x = motionValue(createValue(0))
                const y = springValue(x)

                y.on("change", (v) => resolve(v))
                x.set(createValue(100))
            })

            const resolved = await promise

            expect(resolved).not.toBe(createValue(0))
            expect(resolved).not.toBe(createValue(100))
        })

        test("creates a spring that animates to the subscribed motion value", async () => {
            const promise = new Promise<Array<string | number>>((resolve) => {
                const output: Array<string | number> = []
                const x = motionValue(createValue(0))
                const y = springValue(x, {
                    driver: syncDriver(10),
                } as any)

                y.on("change", (v) => {
                    if (output.length >= 10) {
                        resolve(output)
                    } else {
                        output.push(formatOutput(parseTestValue(v)))
                    }
                })

                x.set(createValue(100))
            })

            const resolved = await promise

            const testNear = (
                value: string | number,
                expected: number,
                deviation = 2
            ) => {
                const numValue = parseTestValue(value)
                expect(
                    numValue >= expected - deviation &&
                        numValue <= expected + deviation
                ).toBe(true)
            }

            testNear(resolved[0], 0)
            testNear(resolved[4], 10)
            testNear(resolved[8], 30)
        })

        test("will not animate if immediate=true", async () => {
            const promise = new Promise((resolve) => {
                const output: Array<string | number> = []
                const x = motionValue(createValue(0))
                const y = springValue(x, {
                    driver: syncDriver(10),
                } as any)

                y.on("change", (v) => {
                    if (output.length >= 10) {
                    } else {
                        output.push(formatOutput(parseTestValue(v)))
                    }
                })

                y.jump(createValue(100))

                setTimeout(() => {
                    resolve(output)
                }, 100)
            })

            const resolved = await promise

            expect(resolved).toEqual([createValue(100)])
        })

        test("unsubscribes when spring is destroyed", () => {
            const source = motionValue(createValue(0))
            const spring = springValue(source)

            expect((source as any).events.change.getSize()).toBe(1)
            expect((spring as any).events.destroy.getSize()).toBe(1)

            spring.destroy()

            // Cast to any here as `.events` is private API
            expect((source as any).events.change.getSize()).toBe(0)
            expect((spring as any).events.destroy.getSize()).toBe(0)
        })

        test("unsubscribes when source is destroyed", () => {
            const source = motionValue(createValue(0))
            springValue(source)

            expect((source as any).events.change.getSize()).toBe(1)

            source.destroy()

            // Cast to any here as `.events` is private API
            expect((source as any).events.change.getSize()).toBe(0)
        })

        test("Cleanup function works as expected", () => {
            const source = motionValue(createValue(0))
            const spring = motionValue(createValue(0))

            const clean = attachSpring(spring, source)
            clean()
            const clean2 = attachSpring(spring, source)

            expect((source as any).events.change.getSize()).toBe(1)
            expect((spring as any).events.destroy.getSize()).toBe(1)

            clean2()
            const clean3 = attachSpring(spring, source)
            clean3()

            expect((source as any).events.change.getSize()).toBe(0)
            expect((spring as any).events.destroy.getSize()).toBe(0)
        })
    })
}

// Run tests for both number values and percentage values
runSpringTests()
runSpringTests("%")

describe("springValue velocity preservation", () => {
    test("preserves velocity when animation is interrupted with new target", async () => {
        const promise = new Promise<{
            velocityAtInterrupt: number
            velocityAfterInterrupt: number
        }>((resolve) => {
            const x = motionValue(0)
            let frameCount = 0
            let velocityAtInterrupt = 0
            let velocityAfterInterrupt = 0

            // Use stiff spring for faster velocity buildup
            const spring = springValue(x, {
                stiffness: 100,
                damping: 10,
                driver: syncDriver(10),
            } as any)

            spring.on("change", () => {
                frameCount++

                // After 5 frames, record velocity and change target
                if (frameCount === 5) {
                    velocityAtInterrupt = spring.getVelocity()
                    // Change target from 100 to 200
                    x.set(200)
                }

                // After 6 frames (1 frame after interrupt), record new velocity
                if (frameCount === 6) {
                    velocityAfterInterrupt = spring.getVelocity()
                    resolve({ velocityAtInterrupt, velocityAfterInterrupt })
                }
            })

            // Start animation towards 100
            x.set(100)
        })

        const { velocityAtInterrupt, velocityAfterInterrupt } = await promise

        // Both velocities should be non-zero
        expect(velocityAtInterrupt).not.toBe(0)
        expect(velocityAfterInterrupt).not.toBe(0)

        // Velocities should have the same sign (both positive, moving right)
        expect(Math.sign(velocityAtInterrupt)).toBe(
            Math.sign(velocityAfterInterrupt)
        )

        // The velocity after interrupt should be reasonably close to before
        // (not exactly equal due to the target change, but should be continuous)
        // Allow up to 50% difference to account for spring physics adjustment
        const ratio = velocityAfterInterrupt / velocityAtInterrupt
        expect(ratio).toBeGreaterThan(0.5)
        expect(ratio).toBeLessThan(2)
    })

    test("velocity should not drop to zero on rapid target changes", async () => {
        const promise = new Promise<number[]>((resolve) => {
            const x = motionValue(0)
            const velocities: number[] = []
            let frameCount = 0

            const spring = springValue(x, {
                stiffness: 50,
                damping: 3,
                driver: syncDriver(4), // Simulate 240Hz with 4ms frames
            } as any)

            spring.on("change", () => {
                frameCount++
                velocities.push(spring.getVelocity())

                // Change target every 3 frames to simulate rapid mouse movement
                if (frameCount % 3 === 0 && frameCount < 15) {
                    x.set(frameCount * 20)
                }

                if (frameCount >= 20) {
                    resolve(velocities)
                }
            })

            x.set(100)
        })

        const velocities = await promise

        // After initial ramp-up (first 3 frames), velocity should never drop to zero
        const velocitiesAfterRampUp = velocities.slice(3)
        const zeroVelocities = velocitiesAfterRampUp.filter((v) => v === 0)

        // Should have very few (ideally zero) zero-velocity frames
        expect(zeroVelocities.length).toBeLessThanOrEqual(1)
    })
})
