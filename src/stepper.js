export default class NumberStepper extends HTMLElement {
  constructor() {
      super()
      const shadow = this.attachShadow({mode: 'closed'})
      this.changeEvent = new CustomEvent('change', {
        bubbles: true,
        cancelable: false,
        composed: true
      })
      const span = document.createElement('span')
      span.className = 'stepper'
      const downButton = document.createElement('button')
      this.input = document.createElement('input')
      this.input.type = 'number'
      this.input.min = 0
      this.input.max = 0
      this.input.value = 0
      this.input.style.width = this.getAttribute('innerwidth')
      this.input.addEventListener('change', function() { 
          this.dispatchEvent(this.changeEvent)
      }.bind(this))
      downButton.innerHTML = '&minus;'
      downButton.addEventListener('click', function() {
          this.input.stepDown()
          this.dispatchEvent(this.changeEvent)
      }.bind(this))
      const upButton = document.createElement('button')
      upButton.innerHTML = '&plus;'
      upButton.addEventListener('click', function() {
          this.input.stepUp()
          this.dispatchEvent(this.changeEvent)
      }.bind(this))
      const linkElem = document.createElement('link')
      linkElem.setAttribute('rel', 'stylesheet')
      linkElem.setAttribute('href', 'app.css')
      span.appendChild(downButton)
      span.appendChild(this.input)
      span.appendChild(upButton)
      shadow.appendChild(linkElem)
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
