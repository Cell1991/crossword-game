export function moveFixedElement(element: HTMLElement | null, x: number, y: number) {
  if (!element) return;
  element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(2deg) scale(1.05)`;
}
