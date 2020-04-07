/*
    Copyright (c) 2020 Oliver Lau <oliver.lau@gmail.com>
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
      this.input.min = +this.getAttribute('min')
      this.input.max = +this.getAttribute('max')
      this.input.value = +this.getAttribute('value')
      this.input.style.width = this.getAttribute('innerwidth')
      this.input.addEventListener('change', function() {
          this.dispatchEvent(this.changeEvent)
      }.bind(this))
      downButton.innerHTML = '&minus;'
      downButton.style.width = h
      downButton.style.height = h
      downButton.addEventListener('click', function() {
          this.input.stepDown()
          this.dispatchEvent(this.changeEvent)
      }.bind(this))
      const upButton = document.createElement('button')
      upButton.innerHTML = '&plus;'
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
  font-family: Calibri, Geneva, Arial, Helvetica, sans-serif;
}
span {
  display: inline-block;
  border: none;
  background-color: #eee;
}
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
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
      this.input.value = v
  }
  set max(v) {
      this.input.max = v
  }
  get max() {
      return this.input.max
  }
}
