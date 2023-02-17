import { div } from "/js/utils.js";

export class SizeHandle extends EventTarget {
    #element
    #targetEl
    #isScaling = false
    #prevX = 0
    #prevY = 0

    #newWidth = 0
    #newHeight = 0

    constructor(parentEl, targetEl) {
        super();
        this.#targetEl = targetEl;
        this.#element = div(parentEl);
        this.#element.classList.add("scale-handle");
        this.#element.classList.add("gizmo");

        this.#element.addEventListener('mousedown', this.#handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.#handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.#handleMouseUp.bind(this));
    }

    #handleMouseDown(event) {
        this.#isScaling = true;
        this.#prevX = event.clientX;
        this.#prevY = event.clientY;
    }

    #handleMouseMove(event) {
        if (!this.#isScaling) {
            return
        }

        const x = event.clientX;
        const y = event.clientY;
        const dx = x - this.#prevX;
        const dy = y - this.#prevY;
        this.#newWidth = Math.max(20, this.#targetEl.offsetWidth + dx);
        this.#newHeight = Math.max(20, this.#targetEl.offsetHeight + dy);
        this.#prevX = x;
        this.#prevY = y;

        this.dispatchEvent(new CustomEvent('size', {
            detail: {
                width: this.#newWidth,
                height: this.#newHeight,
            },
        }));
    }

    #handleMouseUp() {
        if (!this.#isScaling) {
            return
        }

        this.#isScaling = false;

        this.dispatchEvent(new CustomEvent('finalSize', {
            detail: {
                width: this.#newWidth,
                height: this.#newHeight,
            },
        }));
    }

    remove() {
        this.#element.remove();
    }
}