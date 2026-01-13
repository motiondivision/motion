Cypress.config({
    baseUrl: "http://localhost:8000/animate-layout/",
})

describe("animateLayout API", () => {
    const tests = require("../fixtures/animate-layout-tests.json")

    tests.forEach((test) => {
        it(test, () => {
            cy.visit(test)
            cy.wait(250)
                .get('[data-layout-correct="false"]')
                .should("not.exist")
        })
    })
})
