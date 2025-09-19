import { motionValue, MotionValue } from "motion-dom"
import { useEffect } from "react"
import * as THREE from "three"
import { animate } from ".."
import { motion, MotionGlobalConfig } from "../../.."
import { render } from "../../../jest.setup"
import { useMotionValue } from "../../../value/use-motion-value"
import { syncDriver } from "../../animators/__tests__/utils"

const duration = 0.001

describe("animate", () => {
    test("correctly animates MotionValues", async () => {
        const promise = new Promise<[MotionValue, Element]>((resolve) => {
            const Component = () => {
                const x = useMotionValue(0)
                useEffect(() => {
                    animate(x, 200, {
                        duration: 0.1,
                        onComplete: () => {
                            resolve([x, element])
                        },
                    })
                }, [])
                return <motion.div style={{ x }} />
            }

            const { container, rerender } = render(<Component />)
            const element = container.firstChild as Element
            rerender(<Component />)
        })

        const [value, element] = await promise
        expect(value.get()).toBe(200)
        expect(element).toHaveStyle("transform: translateX(200px)")
    })

    test("correctly animates normal values", async () => {
        const promise = new Promise<number>((resolve) => {
            const Component = () => {
                let latest = 0
                useEffect(() => {
                    animate(0, 200, {
                        duration: 0.1,
                        onUpdate: (v) => (latest = v),
                        onComplete: () => {
                            resolve(latest)
                        },
                    })
                }, [])
                return null
            }

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        expect(promise).resolves.toBe(200)
    })

    test("correctly hydrates keyframes null with current MotionValue", async () => {
        const promise = new Promise<number[]>((resolve) => {
            const output: number[] = []
            const Component = () => {
                const x = useMotionValue(100)
                useEffect(() => {
                    animate(x, [null, 50], {
                        duration: 0.1,
                        onComplete: () => {
                            resolve(output)
                        },
                    })
                }, [])
                return null
            }

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        const output = await promise
        const incorrect = output.filter((v) => v < 50)
        // The default would be to animate from 0 here so if theres no values
        // less than 50 the keyframes were correctly hydrated
        expect(incorrect.length).toBe(0)
    })

    test("Accepts all overloads", () => {
        // Checking types only, these are expected to fail given the selector
        expect(() => {
            animate("div", { opacity: 0 })
            animate("div", { opacity: 0 }, { duration: 2 })
        }).toThrow()

        // Elements
        animate(document.createElement("div"), { opacity: 0 })
        animate(document.createElement("div"), { opacity: 0 }, { duration: 2 })

        // Values
        animate(0, 100, { duration: 2 })
        animate("#fff", "#000", { duration: 2 })
        animate("#fff", ["#000"], { duration: 2 })

        // MotionValues
        animate(motionValue(0), 100)
        animate(motionValue(0), [null, 100])
        animate(motionValue(0), [0, 100])
        animate(motionValue("#fff"), "#000")
        animate(motionValue("#fff"), [null, "#000"])
        animate(motionValue("#fff"), ["#fff", "#000"])

        function animateType<V extends string | number>(
            value: V | MotionValue<V>,
            target: V | V[]
        ) {
            animate(value, target)
        }

        animateType(motionValue<number>(0), 100)
        animateType(motionValue<number>(0), [100])
        animateType(motionValue<string>("#fff"), "#000")
    })

    test("animates a motion value in sequence", async () => {
        const a = motionValue(0)

        const aOutput: number[] = []

        a.on("change", (v) => aOutput.push(Math.round(v)))

        const animation = animate(
            [
                [a, 2, { duration: 0.2 }],
                [a, 0, { duration: 0.2 }],
            ],
            {
                defaultTransition: {
                    ease: "linear",
                    driver: syncDriver(20),
                },
            }
        )

        return animation.then(() => {
            expect(aOutput).toEqual([
                0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 0, 0, 0,
            ])
        })
    })

    test("animates motion values in sequence", async () => {
        const a = motionValue(0)
        const b = motionValue(100)

        const aOutput: number[] = []
        const bOutput: number[] = []

        a.on("change", (v) => aOutput.push(Math.round(v)))
        b.on("change", (v) => bOutput.push(Math.round(v)))

        const animation = animate(
            [
                [a, [50, 100]],
                [b, 0],
            ],
            {
                defaultTransition: {
                    ease: "linear",
                    duration: 0.05,
                    driver: syncDriver(20),
                },
            }
        )

        return animation.then(() => {
            expect(aOutput).toEqual([50, 70, 90, 100])
            expect(bOutput).toEqual([80, 40, 0])
        })
    })

    test("Applies target keyframe when animation has finished", async () => {
        const div = document.createElement("div")
        const animation = animate(
            div,
            { opacity: 0.6 },
            { duration, x: {}, "--css-var": {} }
        )
        return animation.then(() => {
            expect(div).toHaveStyle("opacity: 0.6")
        })
    })

    test("Works with multiple elements", async () => {
        const div = document.createElement("div")
        const div2 = document.createElement("div")
        const animation = animate(
            [div, div2],
            { opacity: 0.6 },
            { duration, x: {}, "--css-var": {} }
        )
        await animation.then(() => {
            expect(div).toHaveStyle("opacity: 0.6")
            expect(div2).toHaveStyle("opacity: 0.6")
        })
    })

    test("Applies final target keyframe when animation has finished", async () => {
        const div = document.createElement("div")
        const animation = animate(div, { opacity: [0.2, 0.5] }, { duration })
        await animation.then(() => {
            expect(div).toHaveStyle("opacity: 0.5")
        })
    })

    test("Applies final target keyframe when animation has finished, repeat: reverse", async () => {
        const div = document.createElement("div")
        const animation = animate(
            div,
            { opacity: [0.2, 0.5] },
            {
                duration,
                repeat: 1,
                repeatType: "reverse",
            }
        )
        await animation.then(() => {
            expect(div).toHaveStyle("opacity: 0.2")
        })
    })

    test("Applies final target keyframe when animation has finished, repeat: reverse even", async () => {
        const div = document.createElement("div")
        const animation = animate(
            div,
            { opacity: [0.2, 0.5] },
            { duration, repeat: 2, repeatType: "reverse" }
        )
        await animation.then(() => {
            expect(div).toHaveStyle("opacity: 0.5")
        })
    })

    test("Applies final target keyframe when animation has finished, repeat: mirror", async () => {
        const div = document.createElement("div")
        const animation = animate(
            div,
            { opacity: [0.2, 0.5] },
            { duration, repeat: 1, repeatType: "mirror" }
        )
        await animation.then(() => {
            expect(div).toHaveStyle("opacity: 0.2")
        })
    })

    test("Applies final target keyframe when animation has finished, repeat: mirror even", async () => {
        const div = document.createElement("div")
        const animation = animate(
            div,
            { opacity: [0.2, 0.5] },
            { duration, repeat: 2, repeatType: "mirror" }
        )
        await animation.then(() => {
            expect(div).toHaveStyle("opacity: 0.5")
        })
    })

    test("Skips animations", async () => {
        const div = document.createElement("div")
        MotionGlobalConfig.skipAnimations = true
        animate(div, { opacity: [0.2, 0.5] }, { duration: 1 })
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                MotionGlobalConfig.skipAnimations = false
                expect(div).toHaveStyle("opacity: 0.5")
                resolve()
            }, 100)
        })
    })

    test("time sets and gets time", async () => {
        const div = document.createElement("div")
        const animation = animate(div, { x: 100 }, { duration: 10 })

        expect(animation.time).toBe(0)
        animation.time = 5
        expect(animation.time).toBe(5)
    })

    test(".time can be set to duration", async () => {
        const div = document.createElement("div")
        div.style.opacity = "0"
        const animation = animate(div, { opacity: 0.5 }, { duration: 1 })
        animation.pause()
        animation.time = 1

        return new Promise<void>((resolve) => {
            setTimeout(() => {
                expect(div).toHaveStyle("opacity: 0.5")
                resolve()
            }, 50)
        })
    })

    test("Is typed correctly", async () => {
        const div = document.createElement("div")
        animate(
            div,
            { "--css-var": 0 },
            { duration: 1, "--css-var": { duration: 1 } }
        )
        animate(
            div,
            { pathLength: 0 },
            { duration: 1, pathLength: { duration: 1 } }
        )
        animate(div, { r: 0 }, { duration: 1, r: { duration: 1 } })
    })

    test("Doesn't throw keyframe error", async () => {
        const div = document.createElement("div")
        animate([
            [div, { x: 100 }],
            [div, { y: 100 }],
        ])
    })

    test("will animate spring with existing target and velocity", async () => {
        let max = 0
        const value = motionValue(0)

        value.on("change", (v) => {
            max = Math.max(max, v)
        })

        await animate(value, 0, { type: "spring", velocity: 50 }).finished

        expect(max).toBeGreaterThan(2)
        expect(value.get()).toBe(0)
    })

    test("top-level onComplete fires once when some props are equal and others animate", async () => {
        const calls: number[] = []

        const proxy = new Proxy(
            { x: 0, y: 0 },
            {
                set: (target, p: string, newValue: any) => {
                    if (p === "x" || p === "y") {
                        ;(target as any)[p] = newValue
                    }
                    return true
                },
            }
        )

        const anim = animate(
            proxy,
            { x: 100, y: 0 },
            {
                duration: 0.05,
                onComplete: () => {
                    calls.push(performance.now())
                },
            }
        )

        await anim.finished

        expect(calls.length).toBe(1)
        // And ensure final state reached
        expect(proxy.x).toBeGreaterThanOrEqual(100)
        expect(proxy.y).toBe(0)
    })
})

describe("animate: Objects", () => {
    test("Types: Object to object", () => {
        animate({ x: 100 }, { x: 200 })
        animate({ x: 100, y: 0 }, { x: 200 })
    })

    test("Types: Object to object with transition", () => {
        animate({ x: 100 }, { x: 200 }, { duration: 0.01 })
    })

    test("Types: Object to object with value-specific transitions", () => {
        animate({ x: 100 }, { x: 200 }, { x: { duration: 0.01 } })
    })

    test("Types: Object in sequence", () => {
        animate([[{ x: 100 }, { x: 200 }]])
    })

    test("Types: Object in sequence with transition", () => {
        animate([[{ x: 100 }, { x: 200 }, { duration: 1 }]])
    })

    test("Types: Object in sequence with value-specific transition", () => {
        animate([[{ x: 100 }, { x: 200 }, { x: { duration: 1 } }]])
    })

    test("Types: Object to object with onUpdate", () => {
        const output = { x: 0 }
        animate(
            { x: 100 },
            { x: 200 },
            {
                onUpdate: (latest) => {
                    output.x = latest.x
                },
            }
        )
    })

    test("Types: Three.js Object3D", () => {
        const object = new THREE.Object3D()
        animate(object.rotation, { x: 10 }, { duration: 0.01 })
    })

    test("Types: Three.js Object3D keyframes", () => {
        const object = new THREE.Object3D()
        animate(object.rotation, { x: [null, 10] }, { duration: 0.01 })
    })

    test("Types: Three.js Object3D in sequence", () => {
        const object = new THREE.Object3D()
        animate([[object.rotation, { x: 10 }]])
    })

    test("Types: Three.js Object3D in sequence with transition", () => {
        const object = new THREE.Object3D()
        animate([[object.rotation, { x: 10 }, { duration: 0.01 }]])
    })

    test("Object animates", async () => {
        const obj = { x: 100 }
        await animate(obj, { x: 200 }, { duration: 0.01 })
        expect(obj.x).toBe(200)
    })

    test("Three.js Object3D animates", async () => {
        const obj = new THREE.Object3D()
        await animate(obj.rotation, { x: 10 }, { duration: 0.01 })
        expect(obj.rotation.x).toBe(10)
    })

    test("Object animates in sequence", async () => {
        const obj = { x: 100 }
        await animate([[obj, { x: 200 }, { duration: 0.01 }]])
        expect(obj.x).toBe(200)
    })

    test("Three.js Object3D animates in sequence", async () => {
        const obj = new THREE.Object3D()
        await animate([[obj.rotation, { x: 10 }, { duration: 0.01 }]])
        expect(obj.rotation.x).toBe(10)
    })
})
