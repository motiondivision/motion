import { SVGVisualElement } from "../SVGVisualElement"

const createVisualElement = () =>
    new SVGVisualElement({
        props: {},
        presenceContext: null,
        visualState: {
            latestValues: {},
            renderState: {
                style: {},
                vars: {},
                transform: {},
                transformOrigin: {},
                attrs: {},
            },
        },
    } as any)

describe("SVGVisualElement", () => {
    test.each([
        ["transform", "translateX(10px)"],
        ["opacity", "0.5"],
        ["offsetDistance", "25%"],
        ["offsetPath", 'path("M 0 0 L 1 1")'],
        ["offsetRotate", "auto"],
        ["offsetAnchor", "center"],
    ])("reads %s from CSS style", (key, value) => {
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
        )
        element.style[key as any] = value

        expect(createVisualElement().readValueFromInstance(element, key)).toBe(
            value
        )
    })

    test.each([
        ["transform", "translate(10 20)"],
        ["opacity", "0.25"],
        ["offsetDistance", "50%"],
        ["offsetPath", "none"],
        ["offsetRotate", "reverse"],
        ["offsetAnchor", "auto"],
    ])("falls back to the %s attribute", (key, value) => {
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
        )
        element.setAttribute(
            key.replace(
                /[A-Z]/gu,
                (character) => `-${character.toLowerCase()}`
            ),
            value
        )

        expect(createVisualElement().readValueFromInstance(element, key)).toBe(
            value
        )
    })
})
