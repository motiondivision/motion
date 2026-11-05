import { createBox } from "../../geometry/models"
import {
    compose,
    createComponents,
    decompose,
    mixComponents,
    unwrapRotation,
} from "../decompose"
import {
    conjugateTranslate,
    createMat3,
    invert,
    isAffine,
    isAxisAligned,
    isIdentity,
    multiply,
    rectToRect,
    toMatrix3d,
} from "../mat3"
import {
    boxToQuad,
    createQuad,
    quadBounds,
    quadFromBox,
    transformBoxToQuad,
    transformQuad,
    unitToQuad,
} from "../quad"
import {
    hasNonAxisAlignedTransform,
    projectionToHomography,
    valuesToHomography,
} from "../transform"

function box(x: number, y: number, width: number, height: number) {
    const b = createBox()
    b.x.min = x
    b.x.max = x + width
    b.y.min = y
    b.y.max = y + height
    return b
}

function quad(...points: number[]) {
    return new Float64Array(points)
}

function expectQuad(actual: Float64Array, expected: ArrayLike<number>) {
    for (let i = 0; i < 8; i++) {
        expect(actual[i]).toBeCloseTo(expected[i], 6)
    }
}

/**
 * Deterministic pseudo-random numbers so failures reproduce.
 */
function random(seed: number) {
    return () => {
        seed = (seed * 16807) % 2147483647
        return seed / 2147483647
    }
}

/**
 * A convex quad: a jittered, rotated rectangle.
 */
function randomQuad(next: () => number) {
    const cx = next() * 1000 - 500
    const cy = next() * 1000 - 500
    const w = 50 + next() * 300
    const h = 50 + next() * 300
    const angle = next() * Math.PI * 2
    const corners = [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [w / 2, h / 2],
        [-w / 2, h / 2],
    ]
    const out = createQuad()
    corners.forEach(([x, y], i) => {
        x += (next() - 0.5) * w * 0.3
        y += (next() - 0.5) * h * 0.3
        out[i * 2] = cx + x * Math.cos(angle) - y * Math.sin(angle)
        out[i * 2 + 1] = cy + x * Math.sin(angle) + y * Math.cos(angle)
    })
    return out
}

describe("mat3", () => {
    test("multiply composes right to left", () => {
        const scale = createMat3()
        scale[0] = 2
        scale[4] = 3
        const translate = createMat3()
        translate[2] = 10
        translate[5] = 20

        const out = multiply(createMat3(), translate, scale)
        const point = new Float64Array(8)
        transformBoxToQuad(point, out, box(1, 1, 1, 1))
        expect(point[0]).toBe(12)
        expect(point[1]).toBe(23)
    })

    test("multiply can write into an input", () => {
        const a = createMat3()
        a[1] = 0.5
        const b = createMat3()
        b[3] = 0.25
        const expected = multiply(createMat3(), a, b)
        multiply(a, a, b)
        expect(Array.from(a)).toEqual(Array.from(expected))
    })

    test("invert", () => {
        const next = random(1)
        for (let i = 0; i < 20; i++) {
            const m = createMat3()
            unitToQuad(m, randomQuad(next))
            const inverse = createMat3()
            expect(invert(inverse, m)).toBe(true)
            expect(isIdentity(multiply(inverse, inverse, m), 1e-9)).toBe(true)
        }
    })

    test("invert fails on singular matrices", () => {
        const m = createMat3()
        m[0] = 0
        const out = createMat3()
        out[1] = 5
        expect(invert(out, m)).toBe(false)
        expect(out[1]).toBe(5)
    })

    test("classifies matrices", () => {
        const m = createMat3()
        expect(isIdentity(m)).toBe(true)
        m[0] = 2
        m[2] = 10
        expect(isIdentity(m)).toBe(false)
        expect(isAxisAligned(m)).toBe(true)
        m[1] = 0.1
        expect(isAxisAligned(m)).toBe(false)
        expect(isAffine(m)).toBe(true)
        m[6] = 0.001
        expect(isAffine(m)).toBe(false)
    })

    test("conjugateTranslate moves the origin", () => {
        // Scale 2 about (50, 50)
        const m = createMat3()
        m[0] = m[4] = 2
        conjugateTranslate(m, m, 50, 50)
        const out = createQuad()
        transformBoxToQuad(out, m, box(0, 0, 100, 100))
        expectQuad(out, [-50, -50, 150, -50, 150, 150, -50, 150])
    })

    test("toMatrix3d lists columns", () => {
        const m = createMat3()
        m[2] = 10
        m[5] = 20
        m[6] = 0.5
        expect(toMatrix3d(m)).toBe(
            "matrix3d(1, 0, 0, 0.5, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 0, 1)"
        )
    })
})

describe("quad", () => {
    test("quadFromBox lists corners clockwise from top-left", () => {
        expectQuad(
            quadFromBox(createQuad(), box(10, 20, 100, 50)),
            [10, 20, 110, 20, 110, 70, 10, 70]
        )
    })

    test("quadBounds", () => {
        const bounds = quadBounds(createBox(), quad(5, 0, 10, 5, 5, 10, 0, 5))
        expect(bounds).toEqual({
            x: { min: 0, max: 10 },
            y: { min: 0, max: 10 },
        })
    })

    test("boxToQuad maps every corner of a box onto a quad", () => {
        const next = random(2)
        for (let i = 0; i < 50; i++) {
            const target = randomQuad(next)
            const source = box(
                next() * 500,
                next() * 500,
                10 + next() * 400,
                10 + next() * 400
            )
            const m = createMat3()
            expect(boxToQuad(m, source, target)).toBe(true)
            const out = createQuad()
            expect(transformBoxToQuad(out, m, source)).toBe(true)
            expectQuad(out, target)
        }
    })

    test("boxToQuad between boxes is a translate/scale", () => {
        const m = createMat3()
        boxToQuad(
            m,
            box(0, 0, 100, 100),
            quadFromBox(createQuad(), box(50, 20, 200, 50))
        )
        expect(isAxisAligned(m, 1e-12)).toBe(true)
        expect(m[0]).toBeCloseTo(2)
        expect(m[4]).toBeCloseTo(0.5)
        expect(m[2]).toBeCloseTo(50)
        expect(m[5]).toBeCloseTo(20)
    })

    test("boxToQuad handles parallelograms without perspective", () => {
        const m = createMat3()
        const target = quad(10, 0, 110, 0, 100, 50, 0, 50)
        boxToQuad(m, box(0, 0, 100, 50), target)
        expect(isAffine(m)).toBe(true)
        const out = createQuad()
        transformBoxToQuad(out, m, box(0, 0, 100, 50))
        expectQuad(out, target)
    })

    test("boxToQuad rejects empty boxes and degenerate quads", () => {
        const m = createMat3()
        expect(
            boxToQuad(m, box(0, 0, 0, 100), quad(0, 0, 1, 0, 1, 1, 0, 1))
        ).toBe(false)
        expect(isIdentity(m)).toBe(true)
        expect(
            boxToQuad(m, box(0, 0, 100, 100), quad(0, 0, 1, 1, 2, 2, 3, 3))
        ).toBe(false)
    })

    test("a quad composed through two homographies", () => {
        const next = random(3)
        const a = createMat3()
        const b = createMat3()
        unitToQuad(a, randomQuad(next))
        unitToQuad(b, randomQuad(next))
        const ab = multiply(createMat3(), b, a)
        const square = quad(0, 0, 1, 0, 1, 1, 0, 1)
        const viaA = createQuad()
        transformQuad(viaA, a, square)
        const twice = createQuad()
        transformQuad(twice, b, viaA)
        const once = createQuad()
        transformQuad(once, ab, square)
        expectQuad(twice, once)
    })
})

describe("decompose", () => {
    test("round trips", () => {
        const next = random(4)
        for (let i = 0; i < 50; i++) {
            const source = box(
                next() * 500,
                next() * 500,
                10 + next() * 400,
                10 + next() * 400
            )
            const target = randomQuad(next)
            const m = createMat3()
            boxToQuad(m, source, target)

            const cx = (source.x.min + source.x.max) / 2
            const cy = (source.y.min + source.y.max) / 2
            const components = createComponents()
            expect(decompose(components, m, cx, cy)).toBe(true)

            const recomposed = compose(createMat3(), components, cx, cy)
            const out = createQuad()
            transformBoxToQuad(out, recomposed, source)
            expectQuad(out, target)
        }
    })

    test("a translate/scale decomposes without rotation, skew or perspective", () => {
        const m = rectToRect(createMat3(), 0, 0, 100, 100, 50, 60, 200, 50)
        const components = createComponents()
        decompose(components, m, 50, 50)
        expect(Array.from(components)).toEqual([150, 85, 0, 2, 0.5, 0, 0, 0])
    })

    test("a rotation decomposes to its angle", () => {
        const m = createMat3()
        const angle = Math.PI / 3
        m[0] = m[4] = Math.cos(angle)
        m[1] = -Math.sin(angle)
        m[3] = Math.sin(angle)
        const components = createComponents()
        decompose(components, m, 0, 0)
        expect(components[2]).toBeCloseTo(angle)
        expect(components[3]).toBeCloseTo(1)
        expect(components[4]).toBeCloseTo(1)
        expect(components[5]).toBeCloseTo(0)
    })

    test("a horizontal flip decomposes to a negative scale, not a half turn", () => {
        const m = createMat3()
        m[0] = -1
        const components = createComponents()
        decompose(components, m, 0, 0)
        expect(components[2]).toBeCloseTo(0)
        expect(components[3]).toBe(-1)
        expect(components[4]).toBe(1)
    })

    test("mixing two boxes matches linear box interpolation", () => {
        const from = createComponents()
        const to = createComponents()
        const layout = box(100, 100, 100, 100)
        decompose(
            from,
            rectToRect(createMat3(), 100, 100, 100, 100, 0, 0, 300, 50),
            150,
            150
        )
        decompose(to, createMat3(), 150, 150)

        const mixed = mixComponents(createComponents(), from, to, 0.25)
        const out = createQuad()
        transformBoxToQuad(out, compose(createMat3(), mixed, 150, 150), layout)

        // Each edge moves linearly from (0, 0, 300, 50) to (100, 100, 200, 200)
        expectQuad(out, [25, 25, 275, 25, 275, 87.5, 25, 87.5])
    })

    test("unwrapRotation takes the shortest path", () => {
        const components = createComponents()
        components[2] = Math.PI * 1.9
        unwrapRotation(components, 0)
        expect(components[2]).toBeCloseTo(-Math.PI * 0.1)
        components[2] = -Math.PI * 0.9
        unwrapRotation(components, Math.PI * 0.9)
        expect(components[2]).toBeCloseTo(Math.PI * 1.1)
    })
})

describe("transform", () => {
    const layout = box(100, 100, 100, 50)

    function corners(values: any) {
        const m = valuesToHomography(createMat3(), values, 100, 100, 100, 50)
        const out = createQuad()
        transformBoxToQuad(out, m, layout)
        return out
    }

    test("no values is identity", () => {
        expect(
            isIdentity(valuesToHomography(createMat3(), {}, 0, 0, 10, 10))
        ).toBe(true)
    })

    test("translate and percentage translate", () => {
        expectQuad(
            corners({ x: 10, y: "50%" }),
            [110, 125, 210, 125, 210, 175, 110, 175]
        )
    })

    test("scale about the default origin", () => {
        expectQuad(corners({ scale: 2 }), [50, 75, 250, 75, 250, 175, 50, 175])
    })

    test("scale about a custom origin", () => {
        expectQuad(
            corners({ scale: 2, originX: 0, originY: 0 }),
            [100, 100, 300, 100, 300, 200, 100, 200]
        )
    })

    test("rotate turns clockwise on screen", () => {
        // 90deg about the centre (150, 125)
        expectQuad(
            corners({ rotate: 90 }),
            [175, 75, 175, 175, 125, 175, 125, 75]
        )
    })

    test("translate applies before rotation", () => {
        expectQuad(
            corners({ x: 10, rotate: 90 }),
            [185, 75, 185, 175, 135, 175, 135, 75]
        )
    })

    test("rotateY with perspective foreshortens the far edge", () => {
        const out = corners({ transformPerspective: 500, rotateY: 30 })
        const leftHeight = out[7] - out[1]
        const rightHeight = out[5] - out[3]
        // rotateY(30deg) swings the right edge away from the viewer
        expect(rightHeight).toBeLessThan(50)
        expect(leftHeight).toBeGreaterThan(50)
        expect(
            isAffine(
                valuesToHomography(
                    createMat3(),
                    { transformPerspective: 500, rotateY: 30 },
                    0,
                    0,
                    10,
                    10
                )
            )
        ).toBe(false)
    })

    test("rotateY without perspective is an orthographic squash", () => {
        const out = corners({ rotateY: 60 })
        expect(out[2] - out[0]).toBeCloseTo(50)
        expect(out[7] - out[1]).toBeCloseTo(50)
    })

    test("skewX shears horizontally", () => {
        const out = corners({ skewX: 45 })
        // Top edge moves left, bottom edge right, about the centre
        expect(out[0]).toBeCloseTo(75)
        expect(out[6]).toBeCloseTo(125)
    })

    test("projectionToHomography matches the box delta it renders", () => {
        // A box at (100, 100, 100, 50), projected with origin at its centre
        const m = projectionToHomography(
            createMat3(),
            50,
            -20,
            2,
            0.5,
            1,
            1,
            150,
            125
        )
        const out = createQuad()
        transformBoxToQuad(out, m, layout)
        // translate (50, -20), scale (2, 0.5) about (150, 125)
        expectQuad(out, [100, 92.5, 300, 92.5, 300, 117.5, 100, 117.5])
    })

    test("projectionToHomography counter-scales the tree scale", () => {
        // Inside a parent scaled 2x, translate is halved and scale is unchanged
        const m = projectionToHomography(
            createMat3(),
            50,
            0,
            1,
            1,
            2,
            2,
            150,
            125
        )
        expect(m[0]).toBeCloseTo(1)
        expect(m[2]).toBeCloseTo(25)
    })

    test("hasNonAxisAlignedTransform", () => {
        expect(hasNonAxisAlignedTransform({ x: 10, scale: 2 })).toBe(false)
        expect(hasNonAxisAlignedTransform({ rotate: 10 })).toBe(true)
        expect(hasNonAxisAlignedTransform({ rotateY: 10 })).toBe(true)
        expect(hasNonAxisAlignedTransform({ skewX: 10 })).toBe(true)
    })
})
