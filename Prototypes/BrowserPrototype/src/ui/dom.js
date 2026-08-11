/**
 * LAST TRAIN - small DOM helpers.
 *
 * Just enough to build interfaces in code rather than in markup. Building them
 * in code is what guarantees every string goes through the localization system:
 * there is no HTML file anywhere with English baked into it.
 */

/**
 * Creates an element.
 *
 *   el("button", { class: "button", onclick: start }, "Start")
 *
 * Attributes starting with "on" are attached as listeners. `hidden` and other
 * boolean attributes are set or removed rather than stringified.
 */
export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2), value);
    } else if (key === "class") {
      node.className = value;
    } else if (value === true) {
      node.setAttribute(key, "");
    } else {
      node.setAttribute(key, String(value));
    }
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Wires arrow-key navigation and Enter into a group of buttons, so the menus
 * work without a mouse. Returns a teardown function.
 */
export function makeKeyboardNavigable(container, { onCancel } = {}) {
  const focusables = () =>
    [...container.querySelectorAll("button:not([disabled]), input")].filter(
      (node) => node.offsetParent !== null,
    );

  const handler = (event) => {
    const items = focusables();
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = (index + step + items.length) % items.length;
      items[next].focus();
    } else if (event.key === "Escape" && onCancel) {
      event.preventDefault();
      onCancel();
    }
  };

  container.addEventListener("keydown", handler);
  queueMicrotask(() => focusables()[0]?.focus());
  return () => container.removeEventListener("keydown", handler);
}
