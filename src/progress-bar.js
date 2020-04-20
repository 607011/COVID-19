/*
   ProgressBar custom web element. 
   Copyright (c) 2020 Oliver Lau <oliver@ersatzworld.net>
 */
export default class ProgressBar extends HTMLElement {
  constructor() {
    super()
    const shadowRoot = this.attachShadow({ mode: 'open' })
    shadowRoot.innerHTML = `
<style type="text/css">
.progress-bar {
  --progressbar-color1: rgb(93, 171, 240);
  --progressbar-color2: rgb(43, 72, 97);
  --height: 6px;
  --size: 12px;
  display: block;
  position: fixed;
  left: 0;
  bottom: 0;
  width: 0;
  height: var(--height);
  background-color: var(--progressbar-color1);
  background-image: linear-gradient(-45deg, var(--progressbar-color2) 25%, transparent 25%, transparent 50%, var(--progressbar-color2) 50%, var(--progressbar-color2) 75%, transparent 75%, transparent);
  background-size: var(--size) var(--size);
  box-shadow: inset 0 calc(var(--height) / 2) 0 rgba(255, 255, 255, .2);
  animation: moveBackground 500ms linear infinite;
}
@keyframes moveBackground {
  to { background-position-x: 0; }
  from { background-position-x: var(--size); }
}
</style>
<div class="progress-bar"></div>`
    this.bar = shadowRoot.querySelector('.progress-bar')
    if (this.hasAttribute('height')) {
      this.bar.style.setProperty('--height', this.getAttribute('height'))
    }
    if (this.getAttribute('disabled') === 'true') {
      this.bar.style.display = 'none'
    }
  }
  static get observedAttributes() {
    return ['disabled']
  }
  update(o) {
    this.bar.style.width = `${100 * o.value / (o.max - o.min)}%`
  }
  attributeChangedCallback(attrName, _oldVal, newVal) {
    switch (attrName) {
      case 'disabled':
        this.bar.style.display = newVal !== 'false' ? 'none' : 'block'
        break
      default:
        break;
    }
  }
}
