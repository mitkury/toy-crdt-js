import { element, div, span, nodeHasDataId } from "/js/utils.js"

class BoardView extends EventTarget  {
    #peerId
    #properties
    #canvasEl
    #toolsEl

    constructor(parentElement, peerId) {
        super()

        this.#peerId = peerId
        
        const amountOfCardsInParent = parentElement.getElementsByClassName('demo-card').length;
        const containerEl = div(parentElement, demoCardEl => { 
            demoCardEl.classList.add('demo-card')
            demoCardEl.classList.add('board')
        })
        containerEl.setAttribute('data-card-no', amountOfCardsInParent + 1)
        
        div(containerEl, el => { 
            el.classList.add('title') 
            el.innerText = 'User ' + this.#peerId
        })

        this.#canvasEl = div(containerEl, canvasEl => { 
            canvasEl.classList.add('canvas')

            canvasEl.addEventListener('click', e => {
                const selectedToolEl = this.#getSelectedToolEl()

                const x = e.offsetX
                const y = e.offsetY

                if (selectedToolEl) {
                    console.log(selectedToolEl)

                    const tool = selectedToolEl.getAttribute('data-tool')

                    const entityEl = div(canvasEl, entityEl => {
                        entityEl.classList.add('entity')
                        entityEl.setAttribute('data-id', '1')

                        const width = 50
                        const height = 50

                        entityEl.style.width = width + 'px'
                        entityEl.style.height = height + 'px' 

                        entityEl.style.left = x - width / 2 + 'px'
                        entityEl.style.top = y - height / 2 + 'px'

                        switch (tool) {
                            case 'shape':
                                const shape = selectedToolEl.getAttribute('data-shape')
                                const color = selectedToolEl.getAttribute('data-color')
    
                                div(entityEl, shapeEl => {
                                    shapeEl.classList.add('shape')
                                    shapeEl.setAttribute('data-shape', shape)
        
                                    if (shape == 'triangle') {
                                        shapeEl.style.borderWidth = `${width / 2}px 0px ${height / 2}px ${width}px`
                                        shapeEl.style.borderColor = `transparent transparent transparent ${color}`
                                    } else {
                                        shapeEl.style.backgroundColor = color
                                    }
                                    
                                })
    
                                break
                            case 'emoji':
                                const emoji = selectedToolEl.getAttribute('data-emoji')

                                div(entityEl, emojiEl => {
                                    emojiEl.classList.add('emoji')
                                    emojiEl.innerText = emoji
                                    emojiEl.style.fontSize = height + 'px'
                                })

                                break
                        }


                    })
                }
            })
        })

        this.#toolsEl = div(containerEl, toolsPanelEl => {
            toolsPanelEl.classList.add('tools')
            
            
        })
    
        this.#createTools()
        this.#setColorToAllShapeTools('#1E4FFF')
    }

    #createTools() {
        this.#createShapeTool('circle')
        this.#createShapeTool('rectangle')
        this.#createShapeTool('triangle')
        this.#createEmojiTool('🙈')
    }

    #createShapeTool(type) {
        const toolEl = div(this.#toolsEl, toolEl => {
            toolEl.classList.add('tool')
            toolEl.setAttribute('data-tool', 'shape')
            toolEl.setAttribute('data-shape', type)

            div(toolEl).classList.add('icon')
        })

        toolEl.addEventListener('click', e => {
            this.#handleToolSelection(toolEl)
        })
    }

    #setColorToAllShapeTools(color) {
        const shapeTools = this.#toolsEl.querySelectorAll('[data-tool="shape"]')
        shapeTools.forEach(toolEl => {
            
            toolEl.setAttribute('data-color', color)

            const toolIcon = toolEl.querySelector('.icon')
            const shape = toolEl.getAttribute('data-shape')
            if (shape == 'triangle') {
                toolIcon.style.borderColor = `transparent transparent transparent ${color}`
            } else {
                toolIcon.style.backgroundColor = color
            }
        })
    }

    #createEmojiTool(emoji) {
        const toolEl = div(this.#toolsEl, toolEl => {
            toolEl.classList.add('tool')
            toolEl.setAttribute('data-tool', 'emoji')
            toolEl.setAttribute('data-emoji', emoji)

            div(toolEl, iconEl => { 
                iconEl.classList.add('icon')
                iconEl.innerText = emoji
            })
        })

        toolEl.addEventListener('click', e => {
            this.#handleToolSelection(toolEl)
        })
    }

    #handleToolSelection(toolEl) {
        const currentSelected = this.#toolsEl.querySelector('.selected')
        if (currentSelected) {
          currentSelected.classList.remove('selected')
        }

        if (currentSelected != toolEl) {
            toolEl.classList.add('selected')
        }
    }

    #getSelectedToolEl() {
        return this.#toolsEl.querySelector('.selected')

        /*
        if (selectedToolEl) {
            const toolType = selectedToolEl.getAttribute('data-tool')

            switch (toolType) {
                case 'shape':
                    return { 
                        type: 'shape',
                        shape: selectedToolEl.getAttribute('data-shape')
                    }
            }
        }
        */
    }
}

export class BoardDemo {
    constructor(demosContainerEl) {
        const boardView = new BoardView(demosContainerEl, 'A')

        /*

        const syncButton1 = new SyncButton(demosContainerEl)

        const gCounterView2 = new GCounterView(demosContainerEl, 'B')

        const syncButton2 = new SyncButton(demosContainerEl)

        const gCounterView3 = new GCounterView(demosContainerEl, 'C')

        syncButton1.addCounterView(gCounterView1)
        syncButton1.addCounterView(gCounterView2)

        syncButton2.addCounterView(gCounterView2)
        syncButton2.addCounterView(gCounterView3)
        */
    }
}