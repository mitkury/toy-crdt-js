import { element, div, span, nodeHasDataId } from "/js/utils.js"
import { GCounter } from "/js/counters/gcounter.js"
import { PNCounter } from "/js/counters/pncounter.js"

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



class PNCounterView extends EventTarget {
    #peerId
    #valueEl
    #counter

    constructor(parentElement, peerId) {
        super()
        this.#peerId = peerId
        this.#counter = new PNCounter()

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
            buttonWrapper.classList.add('button-wrapper-2-buttons')
            
            div(buttonWrapper, button => { 
                button.classList.add('button')
                button.innerText = '+'
                button.addEventListener('click', e => { 
                    this.#increment()
                })
            })

            div(buttonWrapper, button => { 
                button.classList.add('button')
                button.innerText = '-'
                button.addEventListener('click', e => { 
                    this.#decrement()
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

    #decrement() {
        this.#counter.decrement(this.#peerId)
        this.render()

        this.#dispatchChange()
    }

    #dispatchChange() {
        this.dispatchEvent(new CustomEvent('change', { detail: this.#counter.value() }));
    }
}

export class PNCounterDemo {
    #gCounterView = null

    constructor(demosContainerEl) {
        const cunterView1 = new PNCounterView(demosContainerEl, 'A')

        const syncButton1 = new SyncButton(demosContainerEl)

        const counterView2 = new PNCounterView(demosContainerEl, 'B')

        const syncButton2 = new SyncButton(demosContainerEl)

        const counterView3 = new PNCounterView(demosContainerEl, 'C')

        syncButton1.addCounterView(cunterView1)
        syncButton1.addCounterView(counterView2)

        syncButton2.addCounterView(counterView2)
        syncButton2.addCounterView(counterView3)
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
                buttonEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clip-rule="evenodd" /></svg> Sync`
                buttonEl.addEventListener('click', e => { 
                    this.#sync()
                })
            })

            div(wrapperEl).classList.add('connection')
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