import { interpolate } from "../interpolate"

const invert = (v: number) => -v

test("interpolate numbers", () => {
    const f = interpolate([0, 100], [0, 1])
    expect(f(50)).toBe(0.5)

    const s = interpolate([-100, 100, 200], [0, 100, 0])
    expect(s(-200)).toBe(0)
    expect(s(0)).toBe(50)
    expect(s(201)).toBe(0)
})

test("interpolate - ease", () => {
    const f = interpolate([0, 100], [0, 100], { ease: invert })
    expect(f(50)).toBe(-50)
})

test("interpolate - 0-width input", () => {
    const f = interpolate([2, 2], [0, 1], { clamp: false })
    expect(f(0)).toBe(0)
    expect(f(1)).toBe(0)
    expect(f(2)).toBe(1)
})

test("interpolate - negative", () => {
    const f = interpolate([-500, 500], [0, 1])
    expect(f(-250)).toBe(0.25)
    const s = interpolate([-500, 500, 600], [0, 1, 2])
    expect(s(-250)).toBe(0.25)
})

test("interpolate - out of range", () => {
    const f = interpolate([0, 100], [200, 100])
    expect(f(50)).toBe(150)
    expect(f(150)).toBe(100)
    expect(f(0)).toBe(200)
    expect(f(-100)).toBe(200)

    const s = interpolate([0, 100, 200], [100, 200, 100])
    expect(s(-50)).toBe(100)
    expect(s(250)).toBe(100)
})

test("interpolate - unclamped", () => {
    const f = interpolate([0, 100], [200, 100], { clamp: false })
    expect(f(50)).toBe(150)
    expect(f(150)).toBe(50)
    expect(f(0)).toBe(200)
    expect(f(-100)).toBe(300)

    const s = interpolate([0, 100, 200], [1, 2, 3], { clamp: false })
    expect(s(-100)).toBe(0)
})

test("interpolate - complex", () => {
    const a = interpolate([0, 100, 200], [1000, 500, 1000])
    expect(a(100)).toBe(500)
})

test("interpolate - reverse", () => {
    const a = interpolate([1000, 0], [500, 600])
    expect(a(500)).toBe(550)
    expect(a(1000)).toBe(500)
    expect(a(0)).toBe(600)
})

test("interpolate - reverse complex", () => {
    const a = interpolate([0, 100, 200], [1000, 500, 1000])
    expect(a(100)).toBe(500)
    expect(a(0)).toBe(1000)
    expect(a(200)).toBe(1000)
})

test("interpolate complex strings", () => {
    const a = interpolate(
        [0, 1, 2],
        [
            "20px, rgba(0, 0, 0, 0)",
            "10px, rgba(255, 255, 255, 1)",
            "40px, rgba(100, 100, 100, 0.5)",
        ]
    )

    expect(a(0)).toBe("20px, rgba(0, 0, 0, 0)")
    expect(a(1.5)).toBe("25px, rgba(194, 194, 194, 0.75)")

    const b = interpolate([0, 1], ["invert(0)", "invert(1)"])
    expect(b(0.5)).toBe("invert(0.5)")
})

test("interpolate colors", () => {
    const a = interpolate([0, 1], ["#000", "#fff"])
    expect(a(0.5)).toBe("rgba(180, 180, 180, 1)")
})

test("interpolate objects", () => {
    const a = interpolate([0, 100], [{ opacity: 0 }, { opacity: 1 }])
    expect(a(50)).toEqual({ opacity: 0.5 })
})

test("interpolate arrays", () => {
    const a = interpolate(
        [0, 100],
        [
            [100, 300],
            [0, 600],
        ]
    )
    expect(a(50)).toEqual([50, 450])
})

test("custom mixer", () => {
    const a = interpolate([0, 1], [0, 1], {
        mixer: () => () => 42,
    })
    expect(a(0.5)).toBe(42)
})

test("interpolate - CSS variables", () => {
    const f = interpolate(
        [0, 1],
        [
            "linear-gradient(var(--10), var(--20, rgba(0,0,0,0)), #fff)",
            "linear-gradient(var(--20), var(--20, rgba(0,0,0,0)), #000)",
        ]
    )
    expect(f(0.5)).toEqual(
        "linear-gradient(var(--20), var(--20, rgba(0,0,0,0)), rgba(180, 180, 180, 1))"
    )
})

test("interpolate - color to CSS variables", () => {
    const f = interpolate(
        [0, 1],
        [
            "linear-gradient(#fff, var(--20, rgba(0,0,0,0)), grey)",
            "linear-gradient(var(--10), var(--20, rgba(0,0,0,0)), grey)",
        ]
    )
    expect(f(0)).toEqual(
        "linear-gradient(#fff, var(--20, rgba(0,0,0,0)), grey)"
    )
    expect(f(0.5)).toEqual(
        "linear-gradient(var(--10), var(--20, rgba(0,0,0,0)), grey)"
    )
    expect(f(1)).toEqual(
        "linear-gradient(var(--10), var(--20, rgba(0,0,0,0)), grey)"
    )
    expect(f(1.4)).toEqual(
        "linear-gradient(var(--10), var(--20, rgba(0,0,0,0)), grey)"
    )
})
