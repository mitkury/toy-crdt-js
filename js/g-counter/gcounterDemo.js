import { element, div, span, nodeHasDataId } from "/js/utils.js"
import { GCounter } from "/js/g-counter/gcounter.js"

class GCounterView extends EventTarget {
    #peerId
    #valueEl
    #counter

    constructor(parentElement, peerId) {
        super()
        this.#peerId = peerId
        this.#counter = new GCounter()

        const amountOfCardsInParent = parentElement.getElementsByClassName('demo-card').length;
        const containerEl = div(parentElement, demoCardEl => { 
            demoCardEl.classList.add('demo-card')
            demoCardEl.classList.add('counter')
        })
        containerEl.setAttribute('data-card-no', amountOfCardsInParent + 1)
        
        div(containerEl, el => { 
            el.classList.add('title') 
            el.innerText = 'User ' + this.#peerId
        })
        
        this.#valueEl = div(containerEl, valueEl => valueEl.classList.add('value'))

        div(containerEl, buttonWrapper => { 
            buttonWrapper.classList.add('button-wrapper')
            
            div(buttonWrapper, button => { 
                button.classList.add('button')
                button.innerText = 'Add +1'
                button.addEventListener('click', e => { 
                    this.#increment()
                })
            })
        })


        this.render()
    }

    merge(other) {
        this.#counter.merge(other.#counter)
        this.render()

        this.#dispatchChange()
    }

    render() {
        this.#valueEl.innerText = this.#counter.value()
    }

    equals(other) {
        return this.#counter.equals(other.#counter)
    }

    #increment() {
        this.#counter.increment(this.#peerId)
        this.render()

        this.#dispatchChange()
    }

    #dispatchChange() {
        this.dispatchEvent(new CustomEvent('change', { detail: this.#counter.value() }));
    }
}

export class GCounterDemo {
    #gCounterView = null

    constructor(demosContainerEl) {
        const gCounterView1 = new GCounterView(demosContainerEl, 'A')

        const syncButton1 = new SyncButton(demosContainerEl)

        const gCounterView2 = new GCounterView(demosContainerEl, 'B')

        const syncButton2 = new SyncButton(demosContainerEl)

        const gCounterView3 = new GCounterView(demosContainerEl, 'C')

        syncButton1.addCounterView(gCounterView1)
        syncButton1.addCounterView(gCounterView2)

        syncButton2.addCounterView(gCounterView2)
        syncButton2.addCounterView(gCounterView3)
    }
}

class SyncButton {
    #containerEl
    #counterViews = []

    constructor(parentElement) {
        this.#containerEl = div(parentElement, wrapperEl => {
            wrapperEl.classList.add('sync-button-wrapper')
            
            div(wrapperEl, buttonEl => {
                buttonEl.classList.add('button')
                buttonEl.innerText = 'Sync'
                buttonEl.addEventListener('click', e => { 
                    this.#sync()
                })
            })
        })

        this.#disableOrEnableButton()
    }

    addCounterView(counterView) {
        this.#counterViews.push(counterView)

        counterView.addEventListener('change', e => {
            this.#disableOrEnableButton()
        })
    }

    #sync() {
        for (let i = 0; i < this.#counterViews.length; i++) {
            for (let j = 0; j < this.#counterViews.length; j++) {
                if (i === j) continue

                this.#counterViews[i].merge(this.#counterViews[j])
            }
        }

        this.#disableOrEnableButton()
    }

    #disableOrEnableButton() {
        if (this.#allCounterViewsHaveSameState()) {
            this.#containerEl.classList.add('disabled')
        } else {
            this.#containerEl.classList.remove('disabled')
        }
    }

    #allCounterViewsHaveSameState() {
        for (let i = 1; i < this.#counterViews.length; i++) {
            for (let j = 0; j < this.#counterViews.length; j++) {
                if (i === j) continue

                if (!this.#counterViews[i].equals(this.#counterViews[j])) {
                    return false
                }
            }
        }

        return true
    }
}