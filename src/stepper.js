/*
   NumberStepper custom web element. 
   Copyright (c) 2020 Oliver Lau <oliver@ersatzworld.net>
 */
export default class NumberStepper extends HTMLElement {
  constructor() {
      super()
      const h = this.getAttribute('height')
      const shadow = this.attachShadow({mode: 'closed'})
      this.changeEvent = new CustomEvent('change', {
        bubbles: true,
        cancelable: false,
        composed: true
      })
      const span = document.createElement('span')
      span.className = 'stepper'
      span.style.height = h
      const downButton = document.createElement('button')
      this.input = document.createElement('input')
      this.input.type = 'number'
      this.input.min = this.getAttribute('min') | 0
      this.input.max = this.getAttribute('max') | 0
      this.input.step = this.getAttribute('step') || 1
      this.input.value = this.getAttribute('value') | 0
      this.input.style.width = this.getAttribute('innerwidth')
      this.input.addEventListener('change', function() {
          this.dispatchEvent(this.changeEvent)
      }.bind(this))
      downButton.innerHTML = '&minus;'
      downButton.title = `decrease by ${this.input.step}`
      downButton.style.width = h
      downButton.style.height = h
      downButton.addEventListener('click', function() {
          this.input.stepDown()
          this.dispatchEvent(this.changeEvent)
      }.bind(this))
      const upButton = document.createElement('button')
      upButton.innerHTML = '&plus;'
      upButton.title = `increase by ${this.input.step}`
      upButton.style.width = h
      upButton.style.height = h
      upButton.addEventListener('click', function() {
          this.input.stepUp()
          this.dispatchEvent(this.changeEvent)
      }.bind(this))
      const style = document.createElement('style')
      style.textContent = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: inherit;
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
}
span {
  display: inline-block;
  border: none;
  background-color: #eee;
  white-space: nowrap;
}
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -moz-appearance: none;
  -webkit-appearance: none;
  height: auto;
}
input {
  height: 100%;
  text-align: right;
  border: none;
  overflow: hidden;
  font-size: 150%;
  padding-right: 0.5em;
  background-color: transparent;
}
button {
  text-align: center;
  border: none;
  font-size: 150%;
  font-weight: bold;
  background-color: #999;
  padding: 0;
}
button:active {
  background-color: #eee;
}`
      span.appendChild(downButton)
      span.appendChild(this.input)
      span.appendChild(upButton)
      shadow.appendChild(style)
      shadow.appendChild(span)
  }
  get value() {
      return this.input.value
  }
  set value(v) {
      this.input.value = Math.max(+this.input.min, Math.min(v, +this.input.max))
  }
  set max(v) {
      this.input.max = v
      this.input.value = Math.min(+this.input.value, v)
  }
  get max() {
      return this.input.max
  }
  set step(v) {
    this.input.step = Math.max(v, 0)
  }
  get step() {
    return this.input.step
  }
}
