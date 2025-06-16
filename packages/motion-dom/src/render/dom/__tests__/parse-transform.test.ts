import CSSMatrix from "@thednp/dommatrix"
import { parseValueFromTransform } from "../parse-transform"

describe("parseValueFromTransform", () => {
    describe("with 'none' transform", () => {
        it("should return 0 for non-scale transforms", () => {
            expect(parseValueFromTransform("none", "x")).toBe(0)
            expect(parseValueFromTransform("none", "y")).toBe(0)
            expect(parseValueFromTransform("none", "z")).toBe(0)
            expect(parseValueFromTransform("none", "translateX")).toBe(0)
            expect(parseValueFromTransform("none", "translateY")).toBe(0)
            expect(parseValueFromTransform("none", "translateZ")).toBe(0)
            expect(parseValueFromTransform("none", "rotateX")).toBe(0)
            expect(parseValueFromTransform("none", "rotateY")).toBe(0)
            expect(parseValueFromTransform("none", "rotateZ")).toBe(0)
            expect(parseValueFromTransform("none", "skewX")).toBe(0)
            expect(parseValueFromTransform("none", "skewY")).toBe(0)
            expect(parseValueFromTransform("none", "skew")).toBe(0)
        })

        it("should return 1 for scale transforms", () => {
            expect(parseValueFromTransform("none", "scale")).toBe(1)
            expect(parseValueFromTransform("none", "scaleX")).toBe(1)
            expect(parseValueFromTransform("none", "scaleY")).toBe(1)
        })
    })

    describe("with matrix() transform", () => {
        it("should parse x translation", () => {
            let matrix = new CSSMatrix()
            matrix = matrix.translate(100)
            expect(parseValueFromTransform(matrix.toString(), "x")).toBe(100)
            expect(
                parseValueFromTransform(matrix.toString(), "translateX")
            ).toBe(100)
        })

        it("should parse y translation", () => {
            let matrix = new CSSMatrix()
            matrix = matrix.translate(0, 200)
            expect(parseValueFromTransform(matrix.toString(), "y")).toBe(200)
            expect(
                parseValueFromTransform(matrix.toString(), "translateY")
            ).toBe(200)
        })

        it("should parse scaleX", () => {
            let matrix = new CSSMatrix()
            matrix = matrix.scale(2)
            expect(parseValueFromTransform(matrix.toString(), "scaleX")).toBe(2)
        })

        it("should parse scaleY", () => {
            let matrix = new CSSMatrix()
            matrix = matrix.scale(1, 3)
            expect(parseValueFromTransform(matrix.toString(), "scaleY")).toBe(3)
        })

        it("should parse scale (average of scaleX and scaleY)", () => {
            let matrix = new CSSMatrix()
            matrix = matrix.scale(2, 4)
            expect(parseValueFromTransform(matrix.toString(), "scale")).toBe(3)
        })

        it("should parse skewX", () => {
            // matrix(1, 0.577350, 0, 1, 0, 0) represents skewX(30deg)
            expect(
                parseValueFromTransform(
                    "matrix(1, 0.577350, 0, 1, 0, 0)",
                    "skewX"
                )
            ).toBeCloseTo(30)
        })

        it("should parse skewY", () => {
            // matrix(1, 0, 0.577350, 1, 0, 0) represents skewY(30deg)
            expect(
                parseValueFromTransform(
                    "matrix(1, 0, 0.577350, 1, 0, 0)",
                    "skewY"
                )
            ).toBeCloseTo(30)
        })

        it("should parse rotate", () => {
            let matrix = new CSSMatrix()
            matrix = matrix.rotate(45)
            expect(
                parseValueFromTransform(matrix.toString(), "rotate")
            ).toBeCloseTo(45)
        })

        it("should parse combined transforms", () => {
            let matrix = new CSSMatrix()
            matrix = matrix.translate(100, 200)
            matrix = matrix.scale(2, 3)

            expect(parseValueFromTransform(matrix.toString(), "x")).toBe(100)
            expect(parseValueFromTransform(matrix.toString(), "y")).toBe(200)
            expect(parseValueFromTransform(matrix.toString(), "scaleX")).toBe(2)
            expect(parseValueFromTransform(matrix.toString(), "scaleY")).toBe(3)
            expect(parseValueFromTransform(matrix.toString(), "scale")).toBe(
                2.5
            )
        })
    })

    describe("with matrix3d() transform", () => {
        it("should parse x translation", () => {
            let matrix = new CSSMatrix()
            matrix = matrix.translate(100, 0, 0)
            expect(parseValueFromTransform(matrix.toString(), "x")).toBe(100)
            expect(
                parseValueFromTransform(matrix.toString(), "translateX")
            ).toBe(100)
        })

        it("should parse y translation", () => {
            let matrix = new CSSMatrix()
            matrix = matrix.translate(0, 200, 0)
            expect(parseValueFromTransform(matrix.toString(), "y")).toBe(200)
            expect(
                parseValueFromTransform(matrix.toString(), "translateY")
            ).toBe(200)
        })

        it("should parse z translation", () => {
            let matrix = new CSSMatrix()
            matrix = matrix.translate(0, 0, 300)
            expect(parseValueFromTransform(matrix.toString(), "z")).toBe(300)
            expect(
                parseValueFromTransform(matrix.toString(), "translateZ")
            ).toBe(300)
        })

        it("should parse combined x, y, z translations", () => {
            let matrix = new CSSMatrix()
            matrix = matrix.translate(100, 200, 300)
            expect(parseValueFromTransform(matrix.toString(), "x")).toBe(100)
            expect(parseValueFromTransform(matrix.toString(), "y")).toBe(200)
            expect(parseValueFromTransform(matrix.toString(), "z")).toBe(300)
            expect(
                parseValueFromTransform(matrix.toString(), "translateX")
            ).toBe(100)
            expect(
                parseValueFromTransform(matrix.toString(), "translateY")
            ).toBe(200)
            expect(
                parseValueFromTransform(matrix.toString(), "translateZ")
            ).toBe(300)
        })

        it("should parse 3D scales", () => {
            let matrix = new CSSMatrix()
            matrix = matrix.scale(2, 3)
            expect(parseValueFromTransform(matrix.toString(), "scaleX")).toBe(2)
            expect(parseValueFromTransform(matrix.toString(), "scaleY")).toBe(3)
            expect(parseValueFromTransform(matrix.toString(), "scale")).toBe(
                2.5
            )

            matrix = new CSSMatrix()
            matrix = matrix.scale(0.5, 0.9)
            expect(parseValueFromTransform(matrix.toString(), "scaleX")).toBe(
                0.5
            )
            expect(parseValueFromTransform(matrix.toString(), "scaleY")).toBe(
                0.9
            )
            expect(parseValueFromTransform(matrix.toString(), "scale")).toBe(
                0.7
            )
        })

        it("should parse individual rotations", () => {
            let matrix = new CSSMatrix()
            matrix = matrix.rotate(30, 0, 0)
            expect(
                parseValueFromTransform(matrix.toString(), "rotateX")
            ).toBeCloseTo(30)

            matrix = new CSSMatrix()
            matrix = matrix.rotate(210, 0, 0)
            expect(
                parseValueFromTransform(matrix.toString(), "rotateX")
            ).toBeCloseTo(210)

            matrix = new CSSMatrix()
            matrix = matrix.rotate(0, 45, 0)
            expect(
                parseValueFromTransform(matrix.toString(), "rotateY")
            ).toBeCloseTo(45)

            matrix = new CSSMatrix()
            matrix = matrix.rotate(0, 210, 0)
            expect(
                parseValueFromTransform(matrix.toString(), "rotateY")
            ).toBeCloseTo(210)

            matrix = new CSSMatrix()
            matrix = matrix.rotate(0, 0, 60)

            console.log(matrix.toString())
            expect(
                parseValueFromTransform(matrix.toString(), "rotateZ")
            ).toBeCloseTo(60)
            expect(
                parseValueFromTransform(matrix.toString(), "rotate")
            ).toBeCloseTo(60)

            matrix = new CSSMatrix()
            matrix = matrix.rotate(0, 0, 210)
            expect(
                parseValueFromTransform(matrix.toString(), "rotateZ")
            ).toBeCloseTo(210)
            expect(
                parseValueFromTransform(matrix.toString(), "rotate")
            ).toBeCloseTo(210)
        })

        it.skip("should parse combined 3D rotations", () => {
            let matrix = new CSSMatrix()
            matrix = matrix.rotate(30, 45)
            expect(
                parseValueFromTransform(matrix.toString(), "rotateX")
            ).toBeCloseTo(30)
            expect(
                parseValueFromTransform(matrix.toString(), "rotateY")
            ).toBeCloseTo(45)
        })

        it.skip("should parse combined 3D transforms", () => {
            let matrix = new CSSMatrix()
            matrix = matrix.translate(100, 200, 300)
            matrix = matrix.scale(2, 3)
            matrix = matrix.rotate(30, 45, 60)

            expect(parseValueFromTransform(matrix.toString(), "x")).toBe(100)
            expect(parseValueFromTransform(matrix.toString(), "y")).toBe(200)
            expect(parseValueFromTransform(matrix.toString(), "z")).toBe(300)
            expect(
                parseValueFromTransform(matrix.toString(), "scaleX")
            ).toBeCloseTo(2, 0)
            expect(
                parseValueFromTransform(matrix.toString(), "scaleY")
            ).toBeCloseTo(3, 0)
            expect(
                parseValueFromTransform(matrix.toString(), "scale")
            ).toBeCloseTo(2.5, 0)
            expect(
                parseValueFromTransform(matrix.toString(), "rotateX")
            ).toBeCloseTo(30)
            expect(
                parseValueFromTransform(matrix.toString(), "rotateY")
            ).toBeCloseTo(45)
            expect(
                parseValueFromTransform(matrix.toString(), "rotateZ")
            ).toBeCloseTo(60)
        })

        it("should parse skewX in matrix3d", () => {
            // matrix3d for skewX(30deg)
            const matrix3d =
                "matrix3d(1, 0, 0, 0, 0.577350, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)"
            expect(parseValueFromTransform(matrix3d, "skewX")).toBeCloseTo(30)
        })

        it("should parse skewY in matrix3d", () => {
            // matrix3d for skewY(30deg)
            const matrix3d =
                "matrix3d(1, 0.577350, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)"
            expect(parseValueFromTransform(matrix3d, "skewY")).toBeCloseTo(30)
        })

        it("should parse combined skew transforms in matrix3d", () => {
            // matrix3d for both skewX(30deg) and skewY(45deg)
            const matrix3d =
                "matrix3d(1, 1, 0, 0, 0.577350, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)"
            expect(parseValueFromTransform(matrix3d, "skewX")).toBeCloseTo(30)
            expect(parseValueFromTransform(matrix3d, "skewY")).toBeCloseTo(45)
        })
    })

    describe("with invalid transform", () => {
        it("should return default values for invalid transform strings", () => {
            expect(parseValueFromTransform("invalid", "x")).toBe(0)
            expect(parseValueFromTransform("invalid", "scale")).toBe(1)
            expect(parseValueFromTransform("rotate(45deg)", "x")).toBe(0)
            expect(parseValueFromTransform("translate(100px)", "x")).toBe(0)
        })
    })
})
