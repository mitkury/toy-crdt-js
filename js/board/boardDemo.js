import { element, div, span, nodeHasDataId } from "/js/utils.js"

class BoardView extends EventTarget {
    #peerId
    #properties
    #canvasEl
    #toolsEl
    #entities = new Map()
    #entityCount
    #draggingEntitiesOffset = new Map()

    constructor(parentElement, peerId) {
        super()

        this.#peerId = peerId

        this.#entityCount = 0

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

            canvasEl.addEventListener('click', event => {
                const selectedToolEl = this.#getSelectedToolEl()

                const { x, y } = this.#getPositionOnCanvas(event)

                if (selectedToolEl) {

                    const tool = selectedToolEl.getAttribute('data-tool')
                    const entityId = this.#peerId + '-' + this.#entityCount
                    this.#entityCount++

                    const entityEl = div(canvasEl, entityEl => {
                        entityEl.classList.add('entity')
                        entityEl.setAttribute('data-id', entityId)

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

                                entityEl = div(entityEl, shapeEl => {
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

                                entityEl = div(entityEl, emojiEl => {
                                    emojiEl.classList.add('emoji')
                                    emojiEl.innerText = emoji
                                    emojiEl.style.fontSize = height + 'px'
                                })

                                break
                        }
                    })

                    selectedToolEl.classList.remove('selected')

                    this.#entities.set(entityId, entityEl)

                    entityEl.addEventListener('click', _ => {
                        const isSelected = entityEl.classList.contains('selected')

                        if (isSelected) {
                            entityEl.classList.remove('selected')
                        } else {
                            const selectedEntities = canvasEl.querySelectorAll('.entity.selected')
                            selectedEntities.forEach(entityEl => {
                                entityEl.classList.remove('selected')
                            })

                            entityEl.classList.add('selected')
                        }
                    })

                    entityEl.addEventListener('mousedown', this.#dragStart.bind(this))
                }
            })
        })

        this.#canvasEl.addEventListener('mouseup', this.#dragEnd.bind(this))
        this.#canvasEl.addEventListener('mousemove', this.#drag.bind(this))

        this.#toolsEl = div(containerEl, toolsPanelEl => {
            toolsPanelEl.classList.add('tools')
        })

        document.addEventListener('keydown', event => {
            const selectedEntities = this.#canvasEl.querySelectorAll('.entity.selected')
            if (selectedEntities.length > 0) {
                if (event.key == 'Backspace' || event.key == 'Delete') {
                    selectedEntities.forEach(entityEl => {
                        const entityId = entityEl.getAttribute('data-id')
                        this.#entities.delete(entityId)
                        entityEl.remove()
                    })
                }
            }
        })

        this.#createTools()
        this.#setColorToAllShapeTools('#1E4FFF')
    }

    #dragStart(event) {               
        const entityEl = event.target.closest('.entity')
        if (entityEl) {
            entityEl.classList.add('dragging')

            const rect = entityEl.getBoundingClientRect();
            const offsetX = event.clientX - rect.left;
            const offsetY = event.clientY - rect.top;
            const entityId = entityEl.getAttribute('data-id')
            this.#draggingEntitiesOffset.set(entityId, { offsetX, offsetY })
        }
    }

    #dragEnd(event) {
        const draggingEntities = this.#canvasEl.querySelectorAll('.entity.dragging')

        draggingEntities.forEach(entityEl => {
            entityEl.classList.remove('dragging')
        })
    }

    #drag(event) {
        const draggingEntities = this.#canvasEl.querySelectorAll('.entity.dragging')

        draggingEntities.forEach(entityEl => {
            const { x, y } = this.#getPositionOnCanvas(event)

            const { offsetX, offsetY } = this.#draggingEntitiesOffset.get(entityEl.getAttribute('data-id'))

            entityEl.style.left = x - offsetX + 'px'
            entityEl.style.top = y - offsetY + 'px'
        })
    }

    #getPositionOnCanvas(e) {
        const rect = this.#canvasEl.getBoundingClientRect()
        const x = e.pageX - rect.left
        const y = e.pageY - rect.top

        return { x, y }
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

        toolEl.addEventListener('click', _ => {
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

        toolEl.addEventListener('click', _ => {
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