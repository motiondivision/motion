import { noop, reverseEasing } from "motion-utils"
import { frame } from "../../frameloop"
import { JSAnimation, animateValue } from "../JSAnimation"
import { ValueAnimationOptions } from "../types"
import { syncDriver } from "./utils"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

const linear = noop

function testAnimate<V extends string | number>(
    options: ValueAnimationOptions<V>,
    expected: V[],
    resolve: () => void
) {
    const output: V[] = []
    new JSAnimation({
        driver: syncDriver(20),
        duration: 100,
        ease: linear,
        onUpdate: (v: V) =>
            output.push(typeof v === "number" ? Math.round(v) : (v as any)),
        onComplete: () => {
            expect(output).toEqual(expected)
            resolve()
        },
        ...options,
    })
}

describe("JSAnimation", () => {
    test("Correctly performs an animation with default settings", async () => {
        return new Promise<void>((resolve) =>
            testAnimate(
                { keyframes: [0, 100] },
                [0, 20, 40, 60, 80, 100],
                resolve
            )
        )
    })

    test("Fires onPlay", async () => {
        return new Promise<void>((resolve) => {
            animateValue({
                keyframes: [0, 1],
                duration: 0.001,
                onPlay: resolve,
            })
        })
    })

    test("Correctly stops an animation", async () => {
        const output: number[] = []

        return new Promise<void>((resolve) => {
            const animation = animateValue({
                keyframes: [0, 100],
                driver: syncDriver(20),
                duration: 100,
                ease: linear,
                onUpdate: (v) => {
                    output.push(v)
                    if (v === 40) {
                        animation.stop()
                    }
                },
                onStop: () => {
                    expect(output).toEqual([0, 20, 40])
                    resolve()
                },
            })
        })
    })

    test("Correctly interpolates a string-based keyframes", async () => {
        return new Promise<void>((resolve) => {
            const numeric: number[] = []
            const string: number[] = []
            animateValue({
                driver: syncDriver(20),
                duration: 100,
                ease: linear,
                keyframes: [0, 200],
                onUpdate: (v) => numeric.push(v),
                onComplete: () => {
                    expect(numeric).toEqual([0, 40, 80, 120, 160, 200])

                    animateValue({
                        driver: syncDriver(20),
                        duration: 100,
                        ease: linear,
                        keyframes: ["0%", "200%"],
                        onUpdate: (v) => numeric.push(parseFloat(v)),
                        onComplete: () => {
                            expect(string).not.toEqual(numeric)
                            resolve()
                        },
                    })
                },
            })
        })
    })

    test("Correctly animates spring", async () => {
        return new Promise<void>((resolve) => {
            const numeric: number[] = []
            animateValue({
                type: "spring",
                driver: syncDriver(50),
                keyframes: [0, 200],
                restSpeed: 10,
                restDelta: 0.5,
                onUpdate: (v) => numeric.push(Math.round(v)),
                onComplete: () => {
                    expect(numeric).toEqual([
                        0, 21, 68, 122, 170, 205, 225, 232, 231, 224, 215, 207,
                        200, 197, 195, 195, 196, 197, 199, 200, 200, 201, 201,
                        201, 201, 200,
                    ])
                    resolve()
                },
            })
        })
    })

    test("Correctly animates string spring", async () => {
        return new Promise<void>((resolve) => {
            const string: number[] = []

            animateValue({
                driver: syncDriver(50),
                keyframes: ["0%", "200%"],
                type: "spring",
                restSpeed: 10,
                restDelta: 0.5,
                onUpdate: (v) => string.push(Math.round(parseFloat(v))),
                onComplete: () => {
                    expect(string).toEqual([
                        0, 21, 68, 122, 170, 205, 225, 232, 231, 224, 215, 207,
                        200, 197, 195, 195, 196, 197, 199, 200,
                    ])
                    resolve()
                },
            })
        })
    })

    test("Correctly uses a spring if type is defined explicitly", async () => {
        return new Promise<void>((resolve) => {
            const output: unknown[] = []
            animateValue({
                keyframes: [0, 100],
                driver: syncDriver(20),
                duration: 100,
                ease: linear,
                onUpdate: (v) => output.push(v),
                onComplete: () => {
                    expect(output).not.toEqual([0, 20, 40, 60, 80, 100])
                    resolve()
                },
                type: "spring",
            })
        })
    })

    test("Performs a keyframes animations when to is an array of strings", async () => {
        return new Promise<void>((resolve) => {
            testAnimate(
                { keyframes: ["#f00", "#0f0", "#00f"] },
                [
                    "rgba(255, 0, 0, 1)",
                    "rgba(198, 161, 0, 1)",
                    "rgba(114, 228, 0, 1)",
                    "rgba(0, 228, 114, 1)",
                    "rgba(0, 161, 198, 1)",
                    "#00f",
                ],
                resolve
            )
        })
    })

    test("Correctly animates from/to with a keyframes animation by default", async () => {
        return new Promise<void>((resolve) => {
            testAnimate(
                { keyframes: [50, 150] },
                [50, 70, 90, 110, 130, 150],
                resolve
            )
        })
    })

    test("Correctly animates from/to strings with a keyframes animation by default", async () => {
        return new Promise<void>((resolve) => {
            testAnimate(
                { keyframes: ["#f00", "#00f"] },
                [
                    "rgba(255, 0, 0, 1)",
                    "rgba(228, 0, 114, 1)",
                    "rgba(198, 0, 161, 1)",
                    "rgba(161, 0, 198, 1)",
                    "rgba(114, 0, 228, 1)",
                    "#00f",
                ],
                resolve
            )
        })
    })

    test("Accepts delay", async () => {
        return new Promise<void>((resolve) => {
            testAnimate(
                { keyframes: [0, 100], delay: 100 },
                [0, 0, 0, 0, 0, 0, 20, 40, 60, 80, 100],
                resolve
            )
        })
    })

    test("Accepts negative delay as elapsed", async () => {
        return new Promise<void>((resolve) => {
            testAnimate(
                { keyframes: [0, 100], delay: -50 },
                [50, 70, 90, 100],
                resolve
            )
        })
    })

    test("Correctly repeats", async () => {
        return new Promise<void>((resolve) => {
            testAnimate(
                { keyframes: [0, 100], repeat: 1 },
                [0, 20, 40, 60, 80, 100, 20, 40, 60, 80, 100],
                resolve
            )
        })
    })

    test("Correctly applies repeat type 'loop'", async () => {
        // Large currentTime
        const animation = animateValue({
            keyframes: [0, 100],
            duration: 100,
            repeat: 1,
            repeatType: "loop",
        })

        expect(animation.sample(201).value).toEqual(100)

        // Odd repeat animation
        await new Promise<void>((resolve) => {
            testAnimate(
                {
                    keyframes: [0, 100],
                    ease: "linear",
                    repeat: 1,
                    repeatType: "loop",
                },
                [0, 20, 40, 60, 80, 100, 20, 40, 60, 80, 100],
                resolve
            )
        })

        // Even repeat animation
        return new Promise<void>((resolve) => {
            testAnimate(
                {
                    keyframes: [0, 100],
                    ease: "linear",
                    repeat: 2,
                    repeatType: "loop",
                },
                [
                    0, 20, 40, 60, 80, 100, 20, 40, 60, 80, 100, 20, 40, 60, 80,
                    100,
                ],
                resolve
            )
        })
    })

    test("Correctly applies repeat type 'reverse'", async () => {
        // Large currentTime
        const animation = animateValue({
            keyframes: [0, 100],
            duration: 100,
            repeat: 1,
            repeatType: "reverse",
        })

        expect(animation.sample(201).value).toEqual(0)

        // Odd repeat animation
        await new Promise<void>((resolve) => {
            testAnimate(
                {
                    keyframes: [0, 100],
                    ease: "linear",
                    repeat: 1,
                    repeatType: "reverse",
                },
                [0, 20, 40, 60, 80, 100, 80, 60, 40, 20, 0],
                resolve
            )
        })

        // Even repeat animation
        return new Promise<void>((resolve) => {
            testAnimate(
                {
                    keyframes: [0, 100],
                    ease: "linear",
                    repeat: 2,
                    repeatType: "reverse",
                },
                [
                    0, 20, 40, 60, 80, 100, 80, 60, 40, 20, 0, 20, 40, 60, 80,
                    100,
                ],
                resolve
            )
        })
    })

    test("Correctly applies repeat type 'mirror'", async () => {
        // Large currentTime
        const animation = animateValue({
            keyframes: [0, 100],
            duration: 100,
            repeat: 1,
            repeatType: "mirror",
        })

        expect(animation.sample(201).value).toEqual(0)

        await new Promise<void>((resolve) => {
            testAnimate(
                {
                    keyframes: [0, 100],
                    repeat: 1,
                    ease: reverseEasing((v) => v * v),
                    repeatType: "mirror",
                },
                [0, 36, 64, 84, 96, 100, 64, 36, 16, 4, 0],
                resolve
            )
        })

        return new Promise<void>((resolve) => {
            testAnimate(
                {
                    keyframes: [0, 100],
                    repeat: 2,
                    ease: reverseEasing((v) => v * v),
                    repeatType: "mirror",
                },
                [0, 36, 64, 84, 96, 100, 64, 36, 16, 4, 0, 36, 64, 84, 96, 100],
                resolve
            )
        })
    })

    test("Correctly applies repeatDelay", async () => {
        return new Promise<void>((resolve) => {
            testAnimate(
                { keyframes: [0, 100], repeat: 2, repeatDelay: 100 },
                [
                    0, 20, 40, 60, 80, 100, 100, 100, 100, 100, 100, 20, 40, 60,
                    80, 100, 100, 100, 100, 100, 100, 20, 40, 60, 80, 100,
                ],
                resolve
            )
        })
    })

    test("Correctly applies repeatDelay to reverse", async () => {
        return new Promise<void>((resolve) => {
            testAnimate(
                {
                    keyframes: [0, 100],
                    repeat: 2,
                    repeatDelay: 100,
                    repeatType: "reverse",
                },
                [
                    0, 20, 40, 60, 80, 100, 100, 100, 100, 100, 100, 80, 60, 40,
                    20, 0, 0, 0, 0, 0, 0, 20, 40, 60, 80, 100,
                ],
                resolve
            )
        })
    })

    test("Correctly applies repeatDelay to mirror", async () => {
        return new Promise<void>((resolve) => {
            testAnimate(
                {
                    keyframes: [0, 100],
                    ease: reverseEasing((v) => v * v),
                    repeat: 2,
                    repeatDelay: 100,
                    repeatType: "mirror",
                },
                [
                    0, 36, 64, 84, 96, 100, 100, 100, 100, 100, 100, 64, 36, 16,
                    4, 0, 0, 0, 0, 0, 0, 36, 64, 84, 96, 100,
                ],
                resolve
            )
        })
    })

    test("Runs animations as an underdamped spring", async () => {
        return new Promise<void>((resolve) => {
            const output: number[] = []
            const expected = [
                100, 371, 884, 1259, 1343, 1204, 1006, 883, 873, 937, 1011,
                1050, 1046, 1018, 991, 980, 984, 996, 1005, 1008, 1005, 1001,
                998, 997, 998, 1000, 1001, 1001, 1001, 1000, 1000,
            ]
            animateValue({
                keyframes: [100, 1000],
                type: "spring",
                stiffness: 300,
                restSpeed: 10,
                restDelta: 0.5,
                driver: syncDriver(50),
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: () => {
                    expect(output).toEqual(expected)
                    resolve()
                },
            })
        })
    })

    test("Runs animations as an overdamped spring", async () => {
        return new Promise<void>((resolve) => {
            const output: number[] = []
            const expected = [
                100, 571, 802, 909, 958, 981, 991, 996, 998, 999, 1000,
            ]
            animateValue({
                keyframes: [100, 1000],
                type: "spring",
                stiffness: 300,
                damping: 100,
                restSpeed: 10,
                restDelta: 0.5,
                driver: syncDriver(250),
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: () => {
                    expect(output).toEqual(expected)
                    resolve()
                },
            })
        })
    })

    test("Runs animations as a critically damped spring", async () => {
        return new Promise<void>((resolve) => {
            const output: number[] = []
            const expected = [
                100, 181, 338, 498, 635, 741, 821, 878, 918, 945, 964, 976, 984,
                990, 993, 996, 997, 998, 999, 999, 1000,
            ]
            animateValue({
                keyframes: [100, 1000],
                type: "spring",
                stiffness: 100,
                damping: 20,
                restSpeed: 10,
                restDelta: 0.5,
                driver: syncDriver(50),
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: () => {
                    expect(output).toEqual(expected)
                    resolve()
                },
            })
        })
    })

    test("Runs spring animations on strings", async () => {
        return new Promise<void>((resolve) => {
            const output: string[] = []
            const expected = [
                "rgba(255, 0, 0, 1)",
                "rgba(213, 0, 140, 1)",
                "rgba(92, 0, 238, 1)",
                "rgba(0, 0, 255, 1)",
                "rgba(0, 0, 255, 1)",
                "rgba(0, 0, 255, 1)",
                "rgba(0, 0, 255, 1)",
                "rgba(92, 0, 238, 1)",
                "rgba(96, 0, 236, 1)",
                "rgba(67, 0, 246, 1)",
                "rgba(0, 0, 255, 1)",
                "rgba(0, 0, 255, 1)",
                "rgba(0, 0, 255, 1)",
                "rgba(0, 0, 255, 1)",
                "rgba(25, 0, 254, 1)",
                "rgba(38, 0, 252, 1)",
                "rgba(34, 0, 253, 1)",
                "rgba(18, 0, 254, 1)",
                "rgba(0, 0, 255, 1)",
                "rgba(0, 0, 255, 1)",
                "rgba(0, 0, 255, 1)",
                "#00f",
            ]
            animateValue({
                keyframes: ["#f00", "#00f"],
                type: "spring",
                stiffness: 300,
                driver: syncDriver(50),
                restSpeed: 10,
                restDelta: 0.5,
                onUpdate: (v: string) => output.push(v),
                onComplete: () => {
                    expect(output).toEqual(expected)
                    resolve()
                },
            } as any)
        })
    })

    test("Repeats springs", async () => {
        return new Promise<void>((resolve) => {
            const output: number[] = []
            const expected = [
                100, 371, 884, 1259, 1343, 1204, 1006, 883, 873, 937, 1011,
                1050, 1046, 1018, 991, 980, 984, 996, 1005, 1008, 1005, 1001,
                998, 997, 998, 1000, 1001, 1001, 1001, 1000, 1000, 371, 884,
                1259, 1343, 1204, 1006, 883, 873, 937, 1011, 1050, 1046, 1018,
                991, 980, 984, 996, 1005, 1008, 1005, 1001, 998, 997, 998, 1000,
                1001, 1001, 1001, 1000, 1000,
            ]
            animateValue({
                keyframes: [100, 1000],
                stiffness: 300,
                driver: syncDriver(50),
                repeat: 1,
                restSpeed: 10,
                restDelta: 0.5,
                type: "spring",
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: () => {
                    expect(output).toEqual(expected)
                    resolve()
                },
            })
        })
    })

    test("Repeats springs according to generated spring", async () => {
        return new Promise<void>((resolve) => {
            const output: number[] = []
            const expected = [
                100, 371, 884, 1259, 1343, 1204, 1006, 883, 873, 937, 1011,
                1050, 1046, 1018, 991, 980, 984, 996, 1005, 1008, 1005, 1001,
                998, 997, 998, 1000, 1001, 1001, 1001, 1000, 1000, 371, 884,
                1259, 1343, 1204, 1006, 883, 873, 937, 1011, 1050, 1046, 1018,
                991, 980, 984, 996, 1005, 1008, 1005, 1001, 998, 997, 998, 1000,
                1001, 1001, 1001, 1000, 1000,
            ]
            animateValue({
                keyframes: [100, 1000],
                // Spring isn't actually duration 0.1 as stiffness is defined.
                duration: 0.1,
                stiffness: 300,
                driver: syncDriver(50),
                repeat: 1,
                restSpeed: 10,
                restDelta: 0.5,
                type: "spring",
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: () => {
                    expect(output).toEqual(expected)
                    resolve()
                },
            })
        })
    })

    test("Repeats springs with repeat delay", async () => {
        return new Promise<void>((resolve) => {
            const output: number[] = []
            const expected = [
                100, 371, 884, 1259, 1343, 1204, 1006, 883, 873, 937, 1011,
                1050, 1046, 1018, 991, 980, 984, 996, 1005, 1008, 1005, 1001,
                998, 997, 998, 1000, 1001, 1001, 1001, 1000, 1000, 1000, 1000,
                1000, 1000, 1000, 1000, 371, 884, 1259, 1343, 1204, 1006, 883,
                873, 937, 1011, 1050, 1046, 1018, 991, 980, 984, 996, 1005,
                1008, 1005, 1001, 998, 997, 998, 1000, 1001, 1001, 1001, 1000,
                1000, 1000, 1000, 1000, 1000, 1000, 1000, 371, 884, 1259, 1343,
                1204, 1006, 883, 873, 937, 1011, 1050, 1046, 1018, 991, 980,
                984, 996, 1005, 1008, 1005, 1001, 998, 997, 998, 1000, 1001,
                1001, 1001, 1000, 1000,
            ]
            animateValue({
                keyframes: [100, 1000],
                type: "spring",
                stiffness: 300,
                driver: syncDriver(50),
                repeat: 2,
                repeatDelay: 300,
                restSpeed: 10,
                restDelta: 0.5,
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: () => {
                    expect(output).toEqual(expected)
                    resolve()
                },
            })
        })
    })

    test("Repeats springs as 'reverse'", async () => {
        return new Promise<void>((resolve) => {
            const output: number[] = []
            const expected = [
                100, 371, 884, 1259, 1343, 1204, 1006, 883, 873, 937, 1011,
                1050, 1046, 1018, 991, 980, 984, 996, 1005, 1008, 1005, 1001,
                998, 997, 998, 1000, 1001, 1001, 1001, 1000, 1000, 1000, 1001,
                1001, 1001, 1000, 998, 997, 998, 1001, 1005, 1008, 1005, 996,
                984, 980, 991, 1018, 1046, 1050, 1011, 937, 873, 883, 1006,
                1204, 1343, 1259, 884, 371, 100,
            ]
            animateValue({
                keyframes: [100, 1000],
                stiffness: 300,
                driver: syncDriver(50),
                repeat: 1,
                repeatType: "reverse",
                restSpeed: 10,
                restDelta: 0.5,
                type: "spring",
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: () => {
                    expect(output).toEqual(expected)
                    resolve()
                },
            })
        })
    })

    test("Repeats springs as 'reverse' with repeatDelay", async () => {
        return new Promise<void>((resolve) => {
            const output: number[] = []
            const expected = [
                100, 884, 1343, 1006, 873, 1011, 1046, 991, 984, 1005, 1005,
                998, 998, 1001, 1001, 1000, 1000, 1000, 1000, 1001, 1001, 998,
                998, 1005, 1005, 984, 991, 1046, 1011, 873, 1006, 1343, 884,
                100, 100, 100, 100, 884, 1343, 1006, 873, 1011, 1046, 991, 984,
                1005, 1005, 998, 998, 1001, 1001, 1000,
            ]
            animateValue({
                keyframes: [100, 1000],
                stiffness: 300,
                driver: syncDriver(100),
                repeat: 2,
                type: "spring",
                repeatType: "reverse",
                repeatDelay: 300,
                restSpeed: 10,
                restDelta: 0.5,
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: () => {
                    expect(output).toEqual(expected)
                    resolve()
                },
            })
        })
    })

    test("Repeats springs as 'mirror'", async () => {
        return new Promise<void>((resolve) => {
            const output: number[] = []
            const expected = [
                100, 371, 884, 1259, 1343, 1204, 1006, 883, 873, 937, 1011,
                1050, 1046, 1018, 991, 980, 984, 996, 1005, 1008, 1005, 1001,
                998, 997, 998, 1000, 1001, 1001, 1001, 1000, 1000, 729, 216,
                -159, -243, -104, 94, 217, 227, 163, 89, 50, 54, 82, 109, 120,
                116, 104, 95, 92, 95, 99, 102, 103, 102, 100, 99, 99, 99, 100,
                100,
            ]
            animateValue({
                keyframes: [100, 1000],
                type: "spring",
                stiffness: 300,
                driver: syncDriver(50),
                repeat: 1,
                restSpeed: 10,
                restDelta: 0.5,
                repeatType: "mirror",
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: () => {
                    expect(output).toEqual(expected)
                    resolve()
                },
            })
        })
    })

    test("Repeats springs as 'mirror' with repeatDelay", async () => {
        return new Promise<void>((resolve) => {
            const output: number[] = []
            const expected = [
                100, 884, 1343, 1006, 873, 1011, 1046, 991, 984, 1005, 1005,
                998, 998, 1001, 1001, 1000, 1000, 1000, 1000, 216, -243, 94,
                227, 89, 54, 109, 116, 95, 95, 102, 102, 99, 99, 100, 100, 100,
                100, 884, 1343, 1006, 873, 1011, 1046, 991, 984, 1005, 1005,
                998, 998, 1001, 1001, 1000,
            ]
            animateValue({
                keyframes: [100, 1000],
                type: "spring",
                stiffness: 300,
                driver: syncDriver(100),
                repeat: 2,
                repeatType: "mirror",
                repeatDelay: 300,
                restSpeed: 10,
                restDelta: 0.5,
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: () => {
                    expect(output).toEqual(expected)
                    resolve()
                },
            })
        })
    })

    test("Finishes springs with explicit velocity", async () => {
        return new Promise<void>((resolve) => {
            animateValue({
                keyframes: [100, 1000],
                type: "spring",
                stiffness: 300,
                velocity: 200,
                driver: syncDriver(100),
                repeat: 2,
                repeatType: "mirror",
                repeatDelay: 300,
                onComplete: () => {
                    expect(true).toEqual(true)
                    resolve()
                },
            })
        })
    })

    test("Decay stays still with no velocity", async () => {
        return new Promise<void>((resolve) => {
            const output: number[] = []
            const expected = [100]
            animateValue({
                keyframes: [100],
                velocity: 0,
                power: 0.8,
                timeConstant: 750,
                type: "decay",
                driver: syncDriver(200),
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: () => {
                    expect(output).toEqual(expected)
                    resolve()
                },
            })
        })
    })

    test("Runs animations as a decay", async () => {
        const expected = [100, 135, 154, 166, 172, 175, 177, 179, 179, 180]
        const promise = new Promise<number[]>((resolve) => {
            const output: number[] = []
            animateValue({
                keyframes: [100],
                velocity: 100,
                type: "decay",
                timeConstant: 350,
                driver: syncDriver(200),
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: () => resolve(output),
            })
        })
        await expect(promise).resolves.toEqual(expected)
    })

    test("Runs animations as a decay with modifyTarget", async () => {
        return new Promise<void>((resolve) => {
            const output: number[] = []
            const expected = [
                100, 213, 277, 313, 334, 345, 352, 355, 357, 358, 359, 360,
            ]

            animateValue({
                keyframes: [100],
                velocity: 100,
                timeConstant: 350,
                modifyTarget: (v) => v * 2,
                driver: syncDriver(200),
                type: "decay",
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: () => {
                    expect(output).toEqual(expected)
                    resolve()
                },
            })
        })
    })

    test("Repeats decay", async () => {
        return new Promise<void>((resolve) => {
            const output: number[] = []
            const expected = [135, 154, 166, 172, 175, 177, 179, 179, 180]
            animateValue({
                keyframes: [100],
                velocity: 100,
                power: 0.8,
                timeConstant: 350,
                repeat: 1,
                type: "decay",
                driver: syncDriver(200),
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: () => {
                    expect(output).toEqual([100, ...expected, ...expected])
                    resolve()
                },
            })
        })
    })

    test("Correctly samples", () => {
        const animation = animateValue({
            keyframes: [0, 1],
            duration: 1000,
            autoplay: false,
            ease: noop,
        })

        expect(animation.sample(500).value).toEqual(0.5)
        expect(animation.sample(0).value).toEqual(0)
        expect(animation.sample(500).value).toEqual(0.5)
        expect(animation.sample(1000).value).toEqual(1)
        expect(animation.sample(500).value).toEqual(0.5)
        expect(animation.sample(0).value).toEqual(0)
    })

    test("Correctly samples with duration: 0", () => {
        const animation = animateValue({
            keyframes: [0, 1],
            duration: 0,
            autoplay: false,
            ease: noop,
        })

        expect(animation.sample(0).value).toEqual(1)
    })

    test("Correctly samples with custom negative elapsed (delay)", () => {
        const animation = animateValue({
            keyframes: [0, 1],
            duration: 1000,
            autoplay: false,
            delay: 500,
            ease: noop,
        })

        expect(animation.sample(0).value).toEqual(0)
        expect(animation.sample(500).value).toEqual(0)
        expect(animation.sample(1000).value).toEqual(0.5)
        expect(animation.sample(1500).value).toEqual(1)
    })

    test("Correctly samples repeating animation", () => {
        const animation = animateValue({
            keyframes: [0, 1],
            duration: 1000,
            repeat: 1,
            autoplay: false,
            ease: noop,
        })

        expect(animation.sample(1500).value).toEqual(0.5)
    })

    test("Correctly samples repeating animation with delay", () => {
        const animation = animateValue({
            keyframes: [0, 1],
            duration: 1000,
            repeat: 1,
            autoplay: false,
            delay: 500,
            ease: noop,
        })

        expect(animation.sample(2000).value).toEqual(0.5)
    })

    test("Correctly samples with negative delay", () => {
        const animation = animateValue({
            keyframes: [0, 1],
            duration: 1000,
            repeat: 1,
            autoplay: false,
            delay: -500,
            ease: noop,
        })

        expect(animation.sample(0).value).toEqual(0.5)
        expect(animation.sample(250).value).toEqual(0.75)
    })

    test("Correctly samples with infinite repeat", () => {
        const animation = animateValue({
            keyframes: [0, 1],
            duration: 1000,
            repeat: Infinity,
            autoplay: false,
            delay: -500,
            ease: noop,
        })

        expect(animation.sample(0).value).toEqual(0.5)
        expect(animation.sample(250).value).toEqual(0.75)
    })

    test("Correctly samples spring with infinite repeat", () => {
        const animation = animateValue({
            keyframes: [0, 100],
            type: "spring",
            stiffness: 400,
            damping: 10,
            repeat: Infinity,
            autoplay: false,
            ease: noop,
        })

        expect(animation.sample(0).value).toEqual(0)
        expect(animation.sample(250).value).toEqual(103.65507873893438)
        expect(animation.sample(4100).value).toEqual(96.10257237444083)
    })

    test("Correctly sets and gets time", async () => {
        const driver = syncDriver(20)
        const output: number[] = []

        await new Promise<void>((resolve) => {
            const animation = animateValue({
                keyframes: [0, 100],
                duration: 100,
                ease: "linear",
                onUpdate: (v) => {
                    output.push(Math.round(v))

                    if (output.length === 4) {
                        animation.time = 0.02
                        expect(animation.time).toEqual(0.02)
                    }
                },
                onComplete: () => resolve(),
                driver,
            })
        })

        expect(output).toEqual([0, 20, 40, 60, 40, 60, 80, 100])
    })

    test("Correctly pauses", async () => {
        const driver = syncDriver(20)
        const output: number[] = []

        await new Promise<void>((resolve) => {
            const animation = animateValue({
                keyframes: [0, 100],
                duration: 100,
                ease: "linear",
                onUpdate: (v) => {
                    output.push(Math.round(v))
                    if (output.length === 4) {
                        animation.pause()
                    } else if (output.length === 10) {
                        animation.stop()
                    }
                },
                onStop: () => resolve(),
                driver,
            })
        })

        expect(output).toEqual([0, 20, 40, 60, 60, 60, 60, 60, 60, 60])
    })

    test("Correctly resumes", async () => {
        const driver = syncDriver(20)
        const output: number[] = []

        await new Promise<void>((resolve) => {
            const animation = animateValue({
                keyframes: [0, 100],
                duration: 100,
                ease: "linear",
                onUpdate: (v) => {
                    output.push(Math.round(v))
                    if (output.length === 2) {
                        animation.pause()
                    } else if (output.length === 6) {
                        animation.play()
                    } else if (output.length === 9) {
                        animation.stop()
                    }
                },
                onStop: () => resolve(),
                driver,
            })
        })

        expect(output).toEqual([0, 20, 20, 20, 20, 20, 40, 60, 80])
    })

    test("Correctly resumes after time is set", async () => {
        const driver = syncDriver(20)
        const output: number[] = []

        await new Promise<void>((resolve) => {
            const animation = animateValue({
                keyframes: [0, 100],
                duration: 100,
                ease: "linear",
                onUpdate: (v) => {
                    output.push(Math.round(v))
                    if (output.length === 2) {
                        animation.pause()
                    } else if (output.length === 6) {
                        animation.time = 0.05
                        animation.play()
                    } else if (output.length === 8) {
                        animation.stop()
                    }
                },
                onStop: () => resolve(),
                driver,
            })
        })

        expect(output).toEqual([0, 20, 20, 20, 20, 20, 70, 90])
    })

    test("Correctly sets time during pause", async () => {
        const driver = syncDriver(20)
        const output: number[] = []

        await new Promise<void>((resolve) => {
            const animation = animateValue({
                keyframes: [0, 100],
                duration: 100,
                ease: "linear",
                onUpdate: (v) => {
                    output.push(Math.round(v))

                    if (output.length === 2) {
                        animation.pause()
                        animation.time = 0.05
                    } else if (output.length === 8) {
                        animation.stop()
                    }
                },
                onStop: () => resolve(),
                driver,
            })
        })

        expect(output).toEqual([0, 20, 50, 50, 50, 50, 50, 50])
    })

    test(".play() restarts the animation if already finished", async () => {
        const driver = syncDriver(20)
        const output: number[] = []
        const animation = animateValue({
            keyframes: [0, 100],
            duration: 100,
            ease: "linear",
            onUpdate: (v) => {
                output.push(Math.round(v))
            },
            driver,
        })

        await animation

        animation.play()

        await animation

        expect(output).toEqual([0, 20, 40, 60, 80, 100, 0, 20, 40, 60, 80, 100])
    })

    test(".play() doesn't start the animation if it has been manually stopped", async () => {
        const driver = syncDriver(20)
        const output: number[] = []
        const animation = animateValue({
            keyframes: [0, 100],
            duration: 100,
            ease: "linear",
            onUpdate: (v) => {
                output.push(Math.round(v))

                if (output.length === 5) animation.stop()
            },
            driver,
        })

        await nextFrame()

        animation.play()

        await nextFrame()

        expect(output).toEqual([0, 20, 40, 60, 80])
    })

    test(".then() can be chained", async () => {
        return new Promise(async (resolve) => {
            const animation = animateValue({
                keyframes: [0, 100],
                duration: 100,
                ease: "linear",
            })

            await animation.then(() => {}).then(resolve)
        })
    })

    test(".then() correctly fires", async () => {
        await animateValue({
            keyframes: [0, 100],
            duration: 100,
            ease: "linear",
            driver: syncDriver(20),
        })
    })

    test(".then() correctly fires when animation already finished", async () => {
        const animation = animateValue({
            keyframes: [0, 100],
            duration: 100,
            ease: "linear",
        })

        return new Promise<void>((resolve) => {
            animation.then(() => resolve())
        })
    })

    test(".then() returns new Promise when animation finished", async () => {
        const animation = animateValue({
            keyframes: [0, 100],
            duration: 100,
            ease: "linear",
        })

        return new Promise<void>((resolve) => {
            animation.then(() => {
                animation.play()
                animation.then(() => resolve())
            })
        })
    })

    test("Correctly resolves when stopped", async () => {
        const output: number[] = []

        return new Promise<void>((resolve) => {
            const animation = animateValue({
                keyframes: [0, 100],
                driver: syncDriver(20),
                duration: 100,
                ease: linear,
                onUpdate: (v) => {
                    output.push(v)
                    if (v === 40) {
                        animation.stop()
                    }
                },
                onStop: () => {
                    expect(output).toEqual([0, 20, 40])
                    resolve()
                },
            })
        })
    })

    test("Correctly cancels an animation", async () => {
        const output: number[] = []

        return new Promise<void>((resolve) => {
            const animation = animateValue({
                keyframes: [0, 100],
                driver: syncDriver(20),
                duration: 100,
                ease: linear,
                onUpdate: (v) => {
                    output.push(v)
                    if (v === 40) {
                        animation.cancel()
                    }
                },
                onCancel: () => {
                    expect(output).toEqual([0, 20, 40, 0])
                    resolve()
                },
            })
        })
    })

    test("Correctly completes an animation", async () => {
        const output: number[] = []

        const animation = animateValue({
            keyframes: [0, 100],
            driver: syncDriver(20),
            duration: 100,
            ease: linear,
            onUpdate: (v) => {
                output.push(v)
                if (v === 40) {
                    animation.complete()
                }
            },
        })

        await animation

        expect(output).toEqual([0, 20, 40, 100])
    })

    test("Updates speed to half speed", async () => {
        const output: number[] = []

        const animation = animateValue({
            keyframes: [0, 100],
            driver: syncDriver(20),
            duration: 100,
            ease: linear,
            onUpdate: (v) => {
                output.push(v)
                if (v === 40) {
                    animation.speed = 0.5
                    expect(animation.speed).toEqual(0.5)
                }
            },
        })

        await animation

        expect(output).toEqual([0, 20, 40, 50, 60, 70, 80, 90, 100])
    })

    test("Updates speed to double speed", async () => {
        const output: number[] = []

        const animation = animateValue({
            keyframes: [0, 100],
            driver: syncDriver(20),
            duration: 100,
            ease: linear,
            onUpdate: (v) => {
                output.push(v)
                if (v === 20) {
                    animation.speed = 2
                    expect(animation.speed).toEqual(2)
                }
            },
        })

        await animation

        expect(output).toEqual([0, 20, 60, 100])
    })

    test("Updates speed to reverse playback", async () => {
        const output: number[] = []

        const animation = animateValue({
            keyframes: [0, 100],
            driver: syncDriver(20),
            duration: 100,
            ease: linear,
            onUpdate: (v) => {
                output.push(v)
                if (v === 40) {
                    animation.speed = -1
                    expect(animation.speed).toEqual(-1)
                }
            },
        })

        await animation

        expect(output).toEqual([0, 20, 40, 20, 0])
    })

    test("Reverse animation from the end", async () => {
        const output: number[] = []

        const animation = animateValue({
            keyframes: [0, 100],
            driver: syncDriver(20),
            duration: 100,
            ease: linear,
            onUpdate: (v) => {
                output.push(v)
            },
        })
        animation.time = 100
        animation.speed = -1

        await animation

        expect(output).toEqual([100, 80, 60, 40, 20, 0])
    })

    test("Reverse animation from the end with half speed", async () => {
        const output: number[] = []

        const animation = animateValue({
            keyframes: [0, 100],
            driver: syncDriver(20),
            duration: 100,
            ease: linear,
            onUpdate: (v) => {
                output.push(v)
            },
        })
        animation.time = 100
        animation.speed = -0.5

        await animation
        expect(output).toEqual([100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0])
    })

    test("Correctly ends animations with duration: 0", async () => {
        const animation = animateValue({
            keyframes: [0, 100],
            driver: syncDriver(20),
            duration: 0,
            ease: linear,
        })

        await animation
    })

    test("Correctly returns duration", async () => {
        expect(
            animateValue({
                keyframes: [0, 100],
                duration: 1000,
            }).duration
        ).toEqual(1)
    })

    test("Correctly returns duration when delay is defined", () => {
        expect(
            animateValue({
                keyframes: [0, 100],
                delay: 1000,
                duration: 1000,
            }).duration
        ).toEqual(1)
    })

    test("Correctly returns duration when repeat is defined", () => {
        expect(
            animateValue({
                keyframes: [0, 100],
                delay: 1000,
                duration: 1000,
                repeat: Infinity,
            }).duration
        ).toEqual(1)
    })

    test("Correctly returns duration when animation is spring", () => {
        expect(
            animateValue({
                keyframes: [0, 100],
                delay: 1000,
                duration: 1000,
                type: "spring",
            }).duration
        ).toEqual(1)
    })

    test("Correctly returns duration when animation is dynamic spring", () => {
        expect(
            animateValue({
                keyframes: [0, 100],
                stiffness: 200,
                damping: 10,
                type: "spring",
            }).duration
        ).toEqual(1.2)
    })
})
