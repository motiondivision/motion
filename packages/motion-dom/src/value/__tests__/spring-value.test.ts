import { syncDriver } from "../../animation/__tests__/utils"
import { spring } from "../../animation/generators/spring"
import { supportsFlags } from "../../utils/supports/flags"
import { motionValue } from "../index"
import { attachFollow } from "../follow-value"
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

describe("spring accelerate config", () => {
    afterEach(() => {
        supportsFlags.linearEasing = undefined
    })

    test("sets .accelerate on MotionValue when spring type and linear easing supported", () => {
        supportsFlags.linearEasing = true

        const source = motionValue(0)
        const value = motionValue(0)
        attachFollow(value, source, { type: "spring" })

        expect(value.accelerate).toBeDefined()
        expect(value.accelerate!.factory).toBe(spring)
        expect(value.accelerate!.times).toEqual([0, 1])
        expect(value.accelerate!.keyframes).toEqual([0, 1])
        expect(value.accelerate!.ease).toBe("linear")
    })

    test("does not set .accelerate when linear easing is not supported", () => {
        supportsFlags.linearEasing = false

        const source = motionValue(0)
        const value = motionValue(0)
        attachFollow(value, source, { type: "spring" })

        expect(value.accelerate).toBeUndefined()
    })

    test("does not set .accelerate when damping is 0", () => {
        supportsFlags.linearEasing = true

        const source = motionValue(0)
        const value = motionValue(0)
        attachFollow(value, source, { type: "spring", damping: 0 })

        expect(value.accelerate).toBeUndefined()
    })

    test("does not set .accelerate for non-spring type", () => {
        supportsFlags.linearEasing = true

        const source = motionValue(0)
        const value = motionValue(0)
        attachFollow(value, source, { type: "keyframes" })

        expect(value.accelerate).toBeUndefined()
    })

    test("passes spring options through accelerate config", () => {
        supportsFlags.linearEasing = true

        const source = motionValue(0)
        const value = motionValue(0)
        attachFollow(value, source, {
            type: "spring",
            stiffness: 300,
            damping: 20,
            mass: 2,
        })

        expect(value.accelerate).toBeDefined()
        expect(value.accelerate!.options.stiffness).toBe(300)
        expect(value.accelerate!.options.damping).toBe(20)
        expect(value.accelerate!.options.mass).toBe(2)
    })

    test("springValue sets .accelerate when linear easing supported", () => {
        supportsFlags.linearEasing = true

        const source = motionValue(0)
        const sv = springValue(source)

        expect(sv.accelerate).toBeDefined()
        expect(sv.accelerate!.factory).toBe(spring)
    })

    test("attachSpring sets .accelerate when linear easing supported", () => {
        supportsFlags.linearEasing = true

        const source = motionValue(0)
        const value = motionValue(0)
        attachSpring(value, source)

        expect(value.accelerate).toBeDefined()
        expect(value.accelerate!.factory).toBe(spring)
    })
})
