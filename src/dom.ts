type Props = {
  class?: string;
  text?: string;
  attrs?: Record<string, string>;
};

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  kids: Array<Node | string | null | false | undefined> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text != null) node.textContent = props.text;
  if (props.attrs) {
    for (const [key, value] of Object.entries(props.attrs)) node.setAttribute(key, value);
  }
  for (const kid of kids) {
    if (kid == null || kid === false) continue;
    node.append(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return node;
}

export function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const node = h('button', { class: className, text, attrs: { type: 'button' } });
  node.addEventListener('click', onClick);
  return node;
}
