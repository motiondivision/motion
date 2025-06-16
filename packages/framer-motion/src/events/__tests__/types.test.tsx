import { Point } from "motion-utils"
import "../../jest.setup"

const relativeTo = (idOrElem: string | HTMLElement) => {
    let elem: HTMLElement | null

    const getElem = () => {
        // Caching element here could be leaky because of React lifecycle
        if (elem !== undefined) return elem
        if (typeof idOrElem === "string") {
            elem = document.getElementById(idOrElem)
        } else {
            elem = idOrElem
        }
        return elem
    }

    return ({ x, y }: Point): Point | undefined => {
        const localElem = getElem()

        if (!localElem) return undefined
        const rect = localElem.getBoundingClientRect()

        return {
            x: x - rect.left - window.scrollX,
            y: y - rect.top - window.scrollY,
        }
    }
}

describe("relativeTo", () => {
    it("should return nothing if there is no element available", () => {
        const convert = relativeTo(null as any)
        expect(convert({ x: 1, y: 1 })).toBeUndefined()
    })
    it("should use provided element", () => {
        const elem = {
            getBoundingClientRect() {
                return { left: 10, top: 5 }
            },
        }
        const convert = relativeTo(elem as HTMLElement)
        expect(convert({ x: 12, y: 12 })).toEqual({ x: 2, y: 7 })
    })
    it("should use element from document if id was provided", () => {
        const elem = {
            getBoundingClientRect() {
                return { left: 10, top: 6 }
            },
        }

        const getElementById = document.getElementById
        document.getElementById = () => elem as HTMLElement
        const convert = relativeTo("test")
        expect(convert({ x: 12, y: 12 })).toEqual({ x: 2, y: 6 })
        document.getElementById = getElementById
    })
})
