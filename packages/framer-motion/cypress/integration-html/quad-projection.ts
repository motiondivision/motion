Cypress.config({
    baseUrl: "http://localhost:8000/quad-projection/",
})

describe("Project elements between quads in transformed spaces", () => {
    const tests = require("../fixtures/quad-projection-tests.json")

    tests.forEach((test) => {
        it(test, () => {
            cy.visit(test)
            cy.get('body[data-done="true"]', { timeout: 10000 })
                .get('[data-layout-correct="false"]')
                .should("not.exist")
        })
    })
})
