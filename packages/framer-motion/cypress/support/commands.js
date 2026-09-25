// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This is will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

/**
 * Yields the subject after the app's next animation frame.
 *
 * Motion processes pointer input (and starts animations) on the next frame,
 * and on slow CI a fixed cy.wait() can resolve before that frame has run:
 * headless Electron can go hundreds of milliseconds without a frame while
 * Cypress keeps running commands. Gesture specs call it after every
 * pointermove, and twice before the first pointerdown so React 19 StrictMode
 * has remounted refs (it does so after the first paint, ending any gesture).
 */
Cypress.Commands.add("nextFrame", { prevSubject: "optional" }, (subject) =>
    cy
        .window({ log: false })
        .then(
            (win) =>
                new Cypress.Promise((resolve) =>
                    win.requestAnimationFrame(() => resolve(subject))
                )
        )
)
