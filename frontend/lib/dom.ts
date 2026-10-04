export function moveFixedElement(element: HTMLElement | null, x: number, y: number, tilt: number = 2) {
  if (!element) return;
  element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${tilt.toFixed(1)}deg) scale(1.06)`;
}
