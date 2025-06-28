/* 
  iOS will trigger a resize event when:
  - The keyboard is shown or hidden
  - The address bar is shown or hidden

  This causes layout animations to suspend when scrolling which can be undesirable.
  Instead of listening to the resize event as is, we compare the window width
  between events and only invoke and thus suspend layout animations if the width actually changes.
*/
export function addResizeEvent(
    target: EventTarget,
    handler: EventListener,
    options: AddEventListenerOptions = { passive: true }
) {
    let initialWidth = window.innerWidth

    function resize(event: Event) {
        if (window.innerWidth !== initialWidth) {
            initialWidth = window.innerWidth
            handler(event)
        }
    }

    target.addEventListener("resize", resize, options)
    return () => target.removeEventListener("resize", resize)
}
