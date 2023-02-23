import { element, div, span } from "/js/utils.js";

export class RotationHandle extends EventTarget {
    #parentEl
    #element

    #targetEl
    #isRotating = false
    #prevAngle = 0
    #angle = 0

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

    #getRotationDegrees(obj, x, y) {
        const rect = obj.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const radians = Math.atan2(y - centerY, x - centerX);
        const degrees = radians * (180 / Math.PI);
        return degrees;
    }

    #handleMouseDown(event) {
        this.#isRotating = true
        this.#prevAngle = this.#getRotationDegrees(this.#targetEl, event.clientX, event.clientY)
        this.#angle = 0
    }

    #handleMouseMove(event) {
        if (!this.#isRotating) {
            return
        }

        const angle = this.#getRotationDegrees(this.#targetEl, event.clientX, event.clientY);
        this.#angle = angle - this.#prevAngle;

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