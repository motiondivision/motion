declare namespace Cypress {
    interface Chainable<Subject = any> {
        /**
         * Yields the subject after the app's next animation frame.
         */
        nextFrame(): Chainable<Subject>
    }
}
