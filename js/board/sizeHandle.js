import { div } from "/toy-crdt-js/js/utils.js";

export class SizeHandle extends EventTarget {
    #element;
    #targetEl;
    #isScaling = false;
    #prevX = 0;
    #prevY = 0;
    #newWidth = 0;
    #newHeight = 0;
    #isProportional = true;

    constructor(parentEl, targetEl) {
        super();
        this.#targetEl = targetEl;
        this.#element = div(parentEl);
        this.#element.classList.add("scale-handle");
        this.#element.classList.add("gizmo");

        this.#element.addEventListener("mousedown", this.#handleMouseDown.bind(this));
        document.addEventListener("mousemove", this.#handleMouseMove.bind(this));
        document.addEventListener("mouseup", this.#handleMouseUp.bind(this));
    }

    set isProportional(value) {
        this.#isProportional = value;
    }

    #handleMouseDown(event) {
        this.#isScaling = true;
        this.#prevX = event.clientX;
        this.#prevY = event.clientY;
    }

    #handleMouseMove(event) {
        if (!this.#isScaling) {
            return;
        }

        const rect = this.#targetEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const x = event.clientX;
        const y = event.clientY;

        const dx = x - this.#prevX;
        const dy = y - this.#prevY;

        const angle = this.#targetEl.rotation || 0;
        const radians = angle * Math.PI / 180;
        const cos = Math.cos(-radians);
        const sin = Math.sin(-radians);

        const rotatedDx = cos * dx - sin * dy;
        const rotatedDy = sin * dx + cos * dy;

        if (this.#isProportional) {
            const prevRatio = this.#targetEl.offsetWidth / this.#targetEl.offsetHeight;
            const newRatio = (this.#targetEl.offsetWidth + rotatedDx) / (this.#targetEl.offsetHeight + rotatedDy);
            const scale = newRatio > prevRatio ? rotatedDx / this.#targetEl.offsetWidth : rotatedDy / this.#targetEl.offsetHeight;
            this.#newWidth = Math.max(20, this.#targetEl.offsetWidth * (1 + scale));
            this.#newHeight = Math.max(20, this.#targetEl.offsetHeight * (1 + scale));
        } else {
            this.#newWidth = Math.max(20, this.#targetEl.offsetWidth + rotatedDx);
            this.#newHeight = Math.max(20, this.#targetEl.offsetHeight + rotatedDy);
        }

        this.#prevX = x;
        this.#prevY = y;

        this.dispatchEvent(new CustomEvent("size", {
            detail: {
                width: this.#newWidth,
                height: this.#newHeight,
            },
        }));
    }

    #handleMouseUp() {
        if (!this.#isScaling) {
            return;
        }

        this.#isScaling = false;

        this.dispatchEvent(new CustomEvent("finalSize", {
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