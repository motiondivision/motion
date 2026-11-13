Cypress.config({
    baseUrl: "http://localhost:8000/projection/",
})

describe("Project the element to its original box", () => {
    const tests = require("../fixtures/projection-tests.json")

    tests.forEach((test) => {
        it(test, () => {
            cy.visit(test)
            /**
             * A page that sets data-layout-pending checks once it removes it,
             * which on a slow machine can be well after this wait.
             */
            cy.wait(250)
                .get("[data-layout-pending]", { timeout: 10000 })
                .should("not.exist")
                .get('[data-layout-correct="false"]')
                .should("not.exist")
        })
    })
})
