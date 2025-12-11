const progress = (from: number, to: number, value: number) => {
    const toFromDifference = to - from
    return toFromDifference === 0 ? 1 : (value - from) / toFromDifference
}

const calculateExpectedProgress = (
    element: HTMLElement,
    axisName: "x" | "y",
    currentScroll: number
): number => {
    const style = window.getComputedStyle(element)
    let isReverse = false
    let scrollLength = 0

    if (axisName === "y") {
        isReverse = style.flexDirection === "column-reverse"
        scrollLength = element.scrollHeight - element.clientHeight
    } else if (axisName === "x") {
        isReverse =
            style.flexDirection === "row-reverse" ||
            style.writingMode === "vertical-rl" ||
            style.direction === "rtl"
        scrollLength = element.scrollWidth - element.clientWidth
    }

    const value = isReverse ? Math.round(-currentScroll) : Math.round(currentScroll)
    return progress(0, scrollLength, value)
}

describe("Scroll progress in reverse-direction containers", () => {
    beforeEach(() => {
        cy.visit("?test=scroll-reverse").wait(1000)
        cy.get("#scroller-1").should("be.visible")
    })

    it("Correctly calculates progress for flex-direction: column-reverse (Container 1)", () => {
        const scrollerId = "#scroller-1"
        const axis = "y"

        cy.get(scrollerId).then(($el) => {
            const element = $el[0] as HTMLElement
            const expectedProgress = calculateExpectedProgress(element, axis, element.scrollTop)
            expect(expectedProgress).to.be.closeTo(0.0, 0.01)
        })

        cy.get(scrollerId)
            .then(($el) => {
                const element = $el[0] as HTMLElement
                console.log(`scrollTop: ${element.scrollTop}`)
                console.log(`scrollLength: ${element.scrollHeight - element.clientHeight}`)
            })
            .scrollTo(0, -500)
            .wait(1000)
            .then(($el) => {
                const element = $el[0] as HTMLElement
                const expectedProgress = calculateExpectedProgress(element, axis, element.scrollTop)
                expect(expectedProgress).to.be.closeTo(0.5, 0.1)
            })

        cy.get(scrollerId)
            .scrollTo(0, -1200)
            .wait(1000)
            .then(($el) => {
                const element = $el[0] as HTMLElement
                const expectedProgress = calculateExpectedProgress(element, axis, element.scrollTop)
                expect(expectedProgress).to.be.closeTo(1.0, 0.01)
            })
    })

    it("Correctly calculates progress for flex-direction: row-reverse (Container 2)", () => {
        const scrollerId = "#scroller-2"
        const axis = "x"

        cy.get(scrollerId).then(($el) => {
            const element = $el[0] as HTMLElement
            const expectedProgress = calculateExpectedProgress(element, axis, element.scrollLeft)
            expect(expectedProgress).to.be.closeTo(0.0, 0.01)
        })

        cy.get(scrollerId)
            .then(($el) => {
                const element = $el[0] as HTMLElement
                console.log(`scrollTop: ${element.scrollTop}`)
                console.log(`scrollLength: ${element.scrollHeight - element.clientHeight}`)
            })
            .scrollTo(-500, 0)
            .wait(100)
            .then(($el) => {
                const element = $el[0] as HTMLElement
                const expectedProgress = calculateExpectedProgress(element, axis, element.scrollLeft)
                expect(expectedProgress).to.be.closeTo(0.5, 0.1)
            })

        cy.get(scrollerId)
            .scrollTo(-1200, 0)
            .wait(100)
            .then(($el) => {
                const element = $el[0] as HTMLElement
                const expectedProgress = calculateExpectedProgress(element, axis, element.scrollLeft)
                expect(expectedProgress).to.be.closeTo(1.0, 0.01)
            })
    })

    it("Correctly calculates progress for writing-mode: vertical-rl (Container 3)", () => {
        const scrollerId = "#scroller-3"
        const axis = "x"

        cy.get(scrollerId).then(($el) => {
            const element = $el[0] as HTMLElement
            const expectedProgress = calculateExpectedProgress(element, axis, element.scrollLeft)
            expect(expectedProgress).to.be.closeTo(0.0, 0.01)
        })

        cy.get(scrollerId)
            .scrollTo(-500, 0)
            .wait(100)
            .then(($el) => {
                const element = $el[0] as HTMLElement
                const expectedProgress = calculateExpectedProgress(element, axis, element.scrollLeft)
                expect(expectedProgress).to.be.closeTo(0.5, 0.1)
            })

        cy.get(scrollerId)
            .scrollTo(-1200, 0)
            .wait(100)
            .then(($el) => {
                const element = $el[0] as HTMLElement
                const expectedProgress = calculateExpectedProgress(element, axis, element.scrollLeft)
                expect(expectedProgress).to.be.closeTo(1.0, 0.01)
            })
    })

    it("Correctly calculates progress for direction: rtl (Container 4)", () => {
        const scrollerId = "#scroller-4"
        const axis = "x"

        cy.get(scrollerId).then(($el) => {
            const element = $el[0] as HTMLElement
            const expectedProgress = calculateExpectedProgress(element, axis, element.scrollLeft)
            expect(expectedProgress).to.be.closeTo(0.0, 0.01)
        })

        cy.get(scrollerId)
            .scrollTo(-500, 0)
            .wait(100)
            .then(($el) => {
                const element = $el[0] as HTMLElement
                const expectedProgress = calculateExpectedProgress(element, axis, element.scrollLeft)
                expect(expectedProgress).to.be.closeTo(0.5, 0.1)
            })

        cy.get(scrollerId)
            .scrollTo(-1200, 0)
            .wait(100)
            .then(($el) => {
                const element = $el[0] as HTMLElement
                const expectedProgress = calculateExpectedProgress(element, axis, element.scrollLeft)
                expect(expectedProgress).to.be.closeTo(1.0, 0.01)
            })
    })
})
