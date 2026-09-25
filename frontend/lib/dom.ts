/**
 * Moves a fixed-position element (the floating drag tile) to follow the pointer. Writing the
 * style directly keeps pointer moves out of React: a render per frame would re-render the whole
 * screen that owns the drag.
 */
export function moveFixedElement(element: HTMLElement | null, x: number, y: number) {
  if (!element) return;
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
}
