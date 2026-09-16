describe("AnimateView entry point", () => {
    it("keeps ordinary Motion working and reports unsupported React versions", () => {
        cy.visit("?test=animate-view")
        cy.get("#ordinary").should("have.css", "opacity", "0.5")
        cy.get("#ordinary").then(($ordinary) => {
            if ($ordinary.text().includes("React 19")) {
                cy.get("#supported").should("have.text", "true")
            }
        })
        cy.get("#supported").then(($supported) => {
            if ($supported.text() === "true") return
            cy.on("uncaught:exception", (error) => {
                if (error.message.includes("AnimateView requires React 19.3"))
                    return false
            })
            cy.get("#toggle").click()
            cy.get("#error").should(
                "contain",
                "AnimateView requires React 19.3"
            )
        })
    })

    for (const mode of ["default", "custom", "share", "update"]) {
        it(`animates ${mode} views with Motion timing`, () => {
            cy.visit(`?test=animate-view&mode=${mode}`)
            cy.get("#supported").then(($supported) => {
                // React 18 exercises import safety and the version error above.
                if ($supported.text() !== "true") return
                cy.document().then((doc) => {
                    expect(typeof (doc as any).startViewTransition).to.equal(
                        "function"
                    )
                })
                cy.get("#toggle").click()
                const type =
                    mode === "share" || mode === "update" ? mode : "enter"
                cy.get("#events")
                    .should("have.attr", `data-${type}`)
                    .then((data) => {
                        const event = JSON.parse(data as unknown as string)
                        expect(event.duration).to.be.closeTo(0.4, 0.01)
                        expect(event.count).to.be.greaterThan(0)
                        if (mode === "custom") expect(event.count).to.equal(1)
                    })
                cy.get("#events").should(
                    "have.attr",
                    `data-${type}-complete`,
                    "true"
                )
                if (type === "enter") {
                    cy.get("#toggle").click()
                    cy.get("#events").should(
                        "have.attr",
                        "data-exit-complete",
                        "true"
                    )
                    cy.get("#view").should("not.exist")
                }
            })
        })
    }
})
