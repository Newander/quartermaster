export const DISMISSABLE_INTERACTION_SELECTOR =
  "[data-dismissable-interaction]"

export const RESIZABLE_HANDLE_INTERACTION = "resizable-handle"

export function isDismissableInteractionTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest(DISMISSABLE_INTERACTION_SELECTOR) !== null
  )
}
