/*
   TabbedPanel custom web element. 
   Copyright (c) 2020 Oliver Lau <oliver@ersatzworld.net>
 */
export default class TabbedPanel extends HTMLElement {
  constructor() {
    super()
    this.tabNames = []
    this.changeEvent = new CustomEvent('change', {
      bubbles: true,
      cancelable: false,
      composed: true,
      detail: { name: null },
    })
    const shadowRoot = this.attachShadow({ mode: 'open' })
    shadowRoot.innerHTML = `
<style>
  :host {
    display: block;
    font-family: inherit;
    contain: content;
  }
  :host([background-color]) {
    background-color: var(--background-color);
  }
  #panels {
    overflow: auto;
    display: block;
    align-self: flex-start;
    flex-grow: 1;
    height: calc(100% - 32px);
    min-height: 300px;
    min-width: 500px;
  }
  #tabs {
    display: flex;
    -webkit-user-select: none;
    user-select: none;
  }
  #tabs slot {
    display: flex;
    justify-content: flex-start;
  }
  #tabs > .filler {
    display: inline-block;
    flex-grow: 2;
    border-bottom: 1px solid #666;
  }
  #tabs ::slotted(*) {
    padding: 5px 16px !important;
    background-color: #555;
    border: 1px solid #666;
    align-self: flex-start;
    outline: none;
    cursor: pointer;
    color: #888;
    font-size: 100%;
    font-family: inherit;
    border-top-left-radius: 7px;
    border-top-right-radius: 7px;
  }
  #tabs ::slotted([aria-selected="true"]) {
    background-color: var(--chart-background-color);
    border-bottom: 1px solid var(--chart-background-color);
    color: #eee;
  }
  #panels ::slotted([aria-hidden="true"]) {
    display: none;
  }
</style>
<div id="tabs">
  <slot id="tabs-slot" name="button"></slot>
  <span class="filler"></span>
</div>
<div id="panels">
  <slot id="panels-slot"></slot>
</div>`
  }

  get selected() {
    return this.selectedIdx
  }

  set selected(newIndexOrName) {
    const newIndex = (typeof newIndexOrName === 'string')
      ? this.tabNames.indexOf(newIndexOrName)
      : (typeof newIndexOrName === 'number')
        ? newIndexOrName
        : -1
    if (newIndex === -1) {
      throw 'parameter must be a string or number'
    }
    if (this.tabs) {
      for (let i = 0; i < this.tabs.length; ++i) {
        const tab = this.tabs[i]
        const isSelected = i === newIndex
        if (isSelected) {
          this.changeEvent.detail.name = tab.name
        }
        tab.setAttribute('tabindex', isSelected ? 0 : -1)
        tab.setAttribute('aria-selected', isSelected)
        this.panels[i].setAttribute('aria-hidden', !isSelected)
      }
      if (newIndex !== this.selectedIdx) {
        this.selectedIdx = newIndex
        this.dispatchEvent(this.changeEvent)
      }
      this.setAttribute('selected', newIndex)
    }
  }

  get names() {
    return this.tabNames
  }

  onButtonClick(e) {
    if (e.target.slot === 'button') {
      this.selected = this.tabs.indexOf(e.target)
      e.target.focus()
    }
  }

  connectedCallback() {
    this.setAttribute('role', 'tablist')
    const tabsSlot = this.shadowRoot.querySelector('#tabs-slot')
    const panelsSlot = this.shadowRoot.querySelector('#panels-slot')
    this.tabs = tabsSlot.assignedNodes({ flatten: true })
    this.tabNames = this.tabs.map(tab => tab.getAttribute('name'))
    this.panels = panelsSlot.assignedNodes({ flatten: true }).filter(el => el.nodeType === Node.ELEMENT_NODE)
    for (const panel of this.panels) {
      panel.setAttribute('role', 'tabpanel')
      panel.setAttribute('tabindex', 0)
    }
    let selectedIdx = 0
    for (const tab of this.tabs) {
      tab.setAttribute('role', 'tab')
      if (tab.hasAttribute('selected')) {
        selectedIdx = i
      }
    }
    this.selected = selectedIdx
    this.onButtonClick = this.onButtonClick.bind(this)
    tabsSlot.addEventListener('click', this.onButtonClick)
  }

  disconnectedCallback() {
    const tabsSlot = this.shadowRoot.querySelector('#tabsSlot')
    tabsSlot.removeEventListener('click', this.onButtonClick)
  }
}
