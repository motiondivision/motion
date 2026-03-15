describe("layoutAnchor: centered child stays centered during parent resize", () => {
    it("Child with layoutAnchor={x:0.5,y:0.5} stays centered mid-animation", () => {
        cy.visit("?test=layout-anchor")
            .wait(50)
            .get("#parent")
            .trigger("click")
            // Wait 5 seconds (50% through 10s linear animation)
            .wait(5000)
            .get("#parent")
            .then(([$parent]: any) => {
                const parentRect = $parent.getBoundingClientRect()
                const parentCenterX = parentRect.left + parentRect.width / 2
                const parentCenterY = parentRect.top + parentRect.height / 2

                const child = $parent.querySelector("#child-anchored")
                const childRect = child.getBoundingClientRect()
                const childCenterX = childRect.left + childRect.width / 2
                const childCenterY = childRect.top + childRect.height / 2

                // With layoutAnchor={x:0.5,y:0.5}, child should stay centered
                expect(childCenterX).to.be.closeTo(parentCenterX, 15)
                expect(childCenterY).to.be.closeTo(parentCenterY, 15)
            })
    })

    it("Child without layoutAnchor drifts from center mid-animation", () => {
        cy.visit("?test=layout-anchor")
            .wait(50)
            .get("#parent")
            .trigger("click")
            .wait(5000)
            .get("#parent-no-anchor")
            .then(([$parent]: any) => {
                const parentRect = $parent.getBoundingClientRect()
                const parentCenterX = parentRect.left + parentRect.width / 2

                const child = $parent.querySelector("#child-no-anchor")
                const childRect = child.getBoundingClientRect()
                const childCenterX = childRect.left + childRect.width / 2

                // Without layoutAnchor, the child should drift away from center
                const drift = Math.abs(childCenterX - parentCenterX)
                expect(drift).to.be.greaterThan(15)
            })
    })
})
