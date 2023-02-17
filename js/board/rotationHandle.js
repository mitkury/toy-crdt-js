import { element, div, span } from "/js/utils.js"

export class RotationHandle extends EventTarget {
    #parentEl
    #element

    #targetEl
    #isRotating = false
    #prevAngle = 0
    #angle = 0
    #prevX = 0

    constructor(parentEl, targetEl) {
        super()
        this.#parentEl = parentEl
        this.#element = div(parentEl)
        this.#element.classList.add("rotation-handle")
        this.#element.classList.add("gizmo")
        this.#targetEl = targetEl

        this.#element.addEventListener('mousedown', this.#handleMouseDown.bind(this))
        
        document.addEventListener('mousemove', this.#handleMouseMove.bind(this))
        
        document.addEventListener('mouseup', this.#handleMouseUp.bind(this))
    }

    #getRotationDegrees(obj) {
        var matrix = getComputedStyle(obj).transform;
        if (matrix === 'none') {
            return 0;
        }
        var values = matrix.split('(')[1].split(')')[0].split(',');
        var a = values[0];
        var b = values[1];
        var angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
        return angle;
    }

    #handleMouseDown(event) {
        this.#isRotating = true
        this.#prevX = event.clientX
        this.#prevAngle = this.#getRotationDegrees(this.#targetEl)
    }

    #handleMouseMove(event) {
        if (!this.#isRotating) {
            return
        }

        var currentX = event.clientX
        this.#angle = this.#prevAngle + (currentX - this.#prevX)
        
        this.dispatchEvent(new CustomEvent('rotation', {
            detail: {
                angle: this.#angle,
            }
        }))
    }

    #handleMouseUp(_) {
        if (!this.#isRotating) {
            return
        }

        this.#isRotating = false

        this.dispatchEvent(new CustomEvent('finalRotation', {
            detail: {
                angle: this.#angle,
            }
        }))
    }

    remove() {
        this.#element.remove()
    }
}