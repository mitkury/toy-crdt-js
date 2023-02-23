import { element, div, span, nodeHasDataId } from "/js/utils.js"
import { getRandomEmoji } from "/js/emojis.js"
import { ReplicatedProperties } from "/js/crdt/properties/replicatedProperties.js"
import { RotationHandle } from '/js/board/rotationHandle.js'
import { SizeHandle } from '/js/board/sizeHandle.js'

class BoardView extends EventTarget {
    #peerId
    #properties
    #tempProperties
    #canvasEl
    #toolsEl
    #entities = new Map()
    #entityCount
    #draggingEntitiesOffset = new Map()

    constructor(parentElement, peerId) {
        super()

        this.#peerId = peerId
        this.#properties = new ReplicatedProperties(peerId)
        this.#tempProperties = new ReplicatedProperties(peerId)

        this.#entityCount = 0

        this.#properties.subscribeToChanges(this.#handlePropertyChange.bind(this))
        this.#tempProperties.subscribeToChanges(this.#handlePropertyChange.bind(this))

        const amountOfCardsInParent = parentElement.getElementsByClassName('demo-card').length;
        const containerEl = div(parentElement, demoCardEl => {
            demoCardEl.classList.add('demo-card')
            demoCardEl.classList.add('board')
        })

        const cardNo = amountOfCardsInParent + 1
        containerEl.setAttribute('data-card-no', cardNo)

        const titleEl = div(containerEl, el => {
            el.classList.add('title')
            el.innerText = 'User ' + this.#peerId
        })

        this.#canvasEl = div(containerEl, canvasEl => {
            canvasEl.classList.add('canvas')

            canvasEl.addEventListener('click', event => {
                const selectedToolEl = this.#getSelectedToolEl()

                if (selectedToolEl) {
                    this.#unselectAllEntities()

                    const { x, y } = this.#getPositionOnCanvas(event)
                    const tool = selectedToolEl.getAttribute('data-tool')
                    const entityId = this.#peerId + this.#entityCount
                    this.#entityCount++

                    this.#properties.setPending(entityId, 'exists', true)

                    const size = {
                        width: 50,
                        height: 50
                    }
                    this.#properties.setPending(entityId, 'size', size)

                    const position = {
                        x: x - size.width / 2,
                        y: y - size.height / 2
                    }
                    this.#properties.setPending(entityId, 'position', position)

                    switch (tool) {
                        case 'shape':
                            const shape = selectedToolEl.getAttribute('data-shape')
                            const color = selectedToolEl.getAttribute('data-color')
                            this.#properties.setPending(entityId, 'shape', shape)
                            this.#properties.setPending(entityId, 'color', color)
                            break

                        case 'emoji':
                            const emoji = selectedToolEl.getAttribute('data-emoji')
                            this.#properties.setPending(entityId, 'emoji', emoji)
                            break
                    }

                    this.#properties.applyPending()

                    selectedToolEl.classList.remove('selected')
                }
            })

            canvasEl.addEventListener('contextmenu', event => {
                event.preventDefault()
            })

            canvasEl.addEventListener('mousedown', event => {
                // Check if we clicked on an entity
                const entityEl = event.target.closest('.entity')

                if (!entityEl) {
                    this.#unselectAllEntities()
                }

            })
        })

        // Detect if clicked outside of parentElement
        document.addEventListener('click', event => {
            if (!parentElement.contains(event.target)) {
                this.#unselectAllEntities()
            }
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
                        this.#properties.set(entityId, 'exists', false)
                    })
                }
            }
        })

        this.#createTools()

        // Get a computed background color of the title element from CSS
        const titleBackgroundColor = window.getComputedStyle(titleEl).backgroundColor
        // And use it as the default color for the shape tools
        this.#setColorToAllShapeTools(titleBackgroundColor)
    }

    equals() {
        return false
    }

    merge(other) {
        this.#tempProperties.merge(other.#tempProperties)
        this.#properties.merge(other.#properties)
    }

    clearTempProperties() {
        this.#tempProperties.clear()
    }

    #handlePropertyChange(operation) {
        const entityId = operation.getEntityId()
        const propertyName = operation.getPropertyName()
        const propertyValue = operation.getValue()

        switch (propertyName) {
            case 'exists':
                this.#createOrDeleteEntity(entityId, propertyValue)
                break

            case 'position':
                this.#setEntityPosition(entityId, propertyValue)
                break

            case 'angle':
                this.#setEntityAngle(entityId, propertyValue)
                break

            case 'size':
                this.#setEntitySize(entityId, propertyValue)
                break

            case 'shape':
                this.#setEntityShape(entityId, propertyValue)
                break

            case 'color':
                this.#setEntityColor(entityId, propertyValue)
                break

            case 'emoji':
                this.#setEntityEmoji(entityId, propertyValue)
                break
        }

        this.#dispatchChange(operation)
    }

    #dispatchChange(operation) {
        this.dispatchEvent(new CustomEvent('change', { detail: operation }));
    }

    #createOrDeleteEntity(entityId, exists) {
        if (exists) {
            const canvasEl = this.#canvasEl

            div(canvasEl, entityEl => {
                entityEl.classList.add('entity')
                entityEl.setAttribute('data-id', entityId)

                const localTrEl = div(entityEl)
                localTrEl.classList.add('local-transform')

                this.#entities.set(entityId, entityEl)

                entityEl.addEventListener('mousedown', this.#handleEntityClick.bind(this, entityEl))
                entityEl.addEventListener('mousedown', this.#dragStart.bind(this))
            })
        } else {
            const entityEl = this.#entities.get(entityId)
            if (!entityEl) {
                return
            }

            entityEl.remove()
            this.#entities.delete(entityId)
        }
    }

    #handleEntityClick(entityEl) {
        /*
        const isSelected = entityEl.classList.contains('selected')
        this.#setEntitySelected(entityEl, !isSelected)
        */
        this.#setEntitySelected(entityEl, true)
    }

    #setEntitySelected(entityEl, doSelect) {
        if (entityEl.classList.contains('selected') == doSelect) {
            return
        }

        if (doSelect) {
            const selectedEntities = this.#canvasEl.querySelectorAll('.entity.selected')
            selectedEntities.forEach(otherEntityEl => {
                this.#setEntitySelected(otherEntityEl, false)
            })

            entityEl.classList.add('selected')
        } else {
            entityEl.classList.remove('selected')
        }

        this.#setupGizmoOnEntity(entityEl, doSelect)
    }

    #unselectAllEntities() {
        const selectedEntities = this.#canvasEl.querySelectorAll('.entity.selected')
        selectedEntities.forEach(entityEl => {
            this.#setEntitySelected(entityEl, false)
        })
    }

    #setEntityPosition(entityId, position) {
        const entityEl = this.#entities.get(entityId)
        if (!entityEl) {
            return
        }

        entityEl.style.left = position.x + 'px'
        entityEl.style.top = position.y + 'px'
    }

    #setEntityAngle(entityId, angle) {
        const entityEl = this.#entities.get(entityId)
        if (!entityEl) {
            return
        }

        const objectEl = entityEl.querySelector('.local-transform')
        if (!objectEl) {
            return
        }

        objectEl.style.transform = `rotate(${angle}deg)`
    }

    #setEntitySize(entityId, size) {
        const entityEl = this.#entities.get(entityId)
        if (!entityEl) {
            return
        }

        const objectEl = entityEl.querySelector('.local-transform')
        if (!objectEl) {
            return
        }

        objectEl.style.width = size.width + 'px'
        objectEl.style.height = size.height + 'px'

        // Check if the entity is a triangle and update its border width
        const shapeEl = entityEl.querySelector('.shape')
        if (shapeEl) {
            const shapeType = shapeEl.getAttribute('data-shape')
            if (shapeType == 'triangle') {
                const width = entityEl.clientWidth
                const height = entityEl.clientHeight
                shapeEl.style.borderWidth = `${width / 2}px 0px ${height / 2}px ${width}px`
            }
        }

        // If the entity is a smile then change its font size
        const emojiEl = entityEl.querySelector('.emoji')
        if (emojiEl) {
            const fontSize = Math.min(size.width, size.height) * 1
            emojiEl.style.fontSize = fontSize + 'px'
        }

    }

    #setEntityShape(entityId, shape) {
        const entityEl = this.#entities.get(entityId)
        if (!entityEl) {
            return
        }

        const localTrEl = entityEl.querySelector('.local-transform')
        localTrEl.innerHTML = ''

        div(localTrEl, shapeEl => {
            shapeEl.classList.add('shape')
            shapeEl.classList.add('object')
            shapeEl.setAttribute('data-shape', shape)

            const width = localTrEl.clientWidth
            const height = localTrEl.clientHeight

            if (shape == 'triangle') {
                shapeEl.style.borderWidth = `${width / 2}px 0px ${height / 2}px ${width}px`
            }
        })
    }

    #setEntityColor(entityId, color) {
        const entityEl = this.#entities.get(entityId)
        if (!entityEl) {
            return
        }

        const shapeEl = entityEl.querySelector('.shape')
        const shape = shapeEl.getAttribute('data-shape')

        if (shape == 'triangle') {
            shapeEl.style.borderColor = `transparent transparent transparent ${color}`
        } else {
            shapeEl.style.backgroundColor = color
        }
    }

    #setEntityEmoji(entityId, emoji) {
        const entityEl = this.#entities.get(entityId)
        if (!entityEl) {
            return
        }

        const localTrEl = entityEl.querySelector('.local-transform')
        localTrEl.innerHTML = ''

        div(localTrEl, emojiEl => {
            emojiEl.classList.add('emoji')
            emojiEl.classList.add('object')
            emojiEl.innerText = emoji
            const fontSize = Math.min(localTrEl.clientWidth, localTrEl.clientHeight) * 1
            emojiEl.style.fontSize = fontSize + 'px'
        })
    }

    #dragStart(event) {
        if (event.target.closest('.gizmo')) {
            return
        }

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

        const { x, y } = this.#getPositionOnCanvas(event)
        this.#setPositionOfDraggingEntities(x, y, false)

        draggingEntities.forEach(entityEl => {
            entityEl.classList.remove('dragging')
        })
    }

    #drag(event) {
        const { x, y } = this.#getPositionOnCanvas(event)
        this.#setPositionOfDraggingEntities(x, y, true)
    }

    #setPositionOfDraggingEntities(cursorX, cursorY, isTemp) {
        const draggingEntities = this.#canvasEl.querySelectorAll('.entity.dragging')

        draggingEntities.forEach(entityEl => {
            const { offsetX, offsetY } = this.#draggingEntitiesOffset.get(entityEl.getAttribute('data-id'))

            const position = {
                x: cursorX - offsetX,
                y: cursorY - offsetY
            }

            const entityId = entityEl.getAttribute('data-id')

            let targetProperties = isTemp ? this.#tempProperties : this.#properties
            targetProperties.set(entityId, 'position', position)
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
        this.#createEmojiTool()
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

    #createEmojiTool() {
        const toolEl = div(this.#toolsEl, toolEl => {
            toolEl.classList.add('tool')
            toolEl.setAttribute('data-tool', 'emoji')

            toolEl.setAttribute('data-emoji', getRandomEmoji())

            div(toolEl, iconEl => {
                iconEl.classList.add('icon')
                iconEl.innerText = '🙈'
            })
        })

        toolEl.addEventListener('click', _ => {
            toolEl.setAttribute('data-emoji', getRandomEmoji())
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

    #activeRotationHandle = null
    #activeSizeHandle = null

    #setupGizmoOnEntity(entityEl, doSetup) {
        if (doSetup) {
            if (entityEl.querySelector('.rotation-handle')) {
                return;
            }

            const entityId = entityEl.getAttribute('data-id')

            // We get the object because we're going to scale and rotate that element 
            // instead of the parent entity element
            const localTransformEl = entityEl.querySelector('.local-transform')

            const rotationHandle = new RotationHandle(localTransformEl, localTransformEl)
            rotationHandle.addEventListener('rotation', event => {
                const angle = event.detail.angle
                this.#tempProperties.set(entityId, 'angle', angle)
            })
            rotationHandle.addEventListener('finalRotation', event => {
                const angle = event.detail.angle
                this.#properties.set(entityId, 'angle', angle)
            })

            const sizeHandle = new SizeHandle(localTransformEl, localTransformEl)
            sizeHandle.addEventListener('size', event => {
                const { width, height } = event.detail
                this.#tempProperties.set(entityId, 'size', { width, height })
            })
            sizeHandle.addEventListener('finalSize', event => {
                const { width, height } = event.detail
                this.#properties.set(entityId, 'size', { width, height })
            })

            this.#activeRotationHandle = rotationHandle
            this.#activeSizeHandle = sizeHandle
        } else {
            if (this.#activeRotationHandle) {
                this.#activeRotationHandle.remove()
                this.#activeRotationHandle = null
            }
            if (this.#activeSizeHandle) {
                this.#activeSizeHandle.remove()
                this.#activeSizeHandle = null
            }

            return
        }
    }

    #getSelectedToolEl() {
        return this.#toolsEl.querySelector('.selected')
    }
}

class SyncRealtimeButton {
    #containerEl
    #views = []
    #on

    constructor(parentElement) {
        this.#on = true

        this.#containerEl = div(parentElement, wrapperEl => {
            wrapperEl.classList.add('sync-button-wrapper')

            div(wrapperEl, buttonEl => {
                buttonEl.classList.add('button')
                buttonEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clip-rule="evenodd" /></svg> Sync`
                buttonEl.addEventListener('click', e => {
                    if (this.#on) {
                        this.#disableSync()
                    } else {
                        this.#enableSync()
                    }
                })
            })

            div(wrapperEl).classList.add('connection')
        })

        requestAnimationFrame(this.#tick.bind(this));
    }

    addView(view) {
        this.#views.push(view)
    }

    #tick() {
        if (this.#on) {
            this.#sync();
        }

        requestAnimationFrame(this.#tick.bind(this));
    }

    #sync() {
        for (let i = 0; i < this.#views.length; i++) {
            for (let j = 0; j < this.#views.length; j++) {
                if (i === j) continue

                this.#views[i].merge(this.#views[j])
            }
        }

        for (let i = 0; i < this.#views.length; i++) {
            this.#views[i].clearTempProperties()
        }
    }

    #disableSync() {
        this.#on = false
        this.#containerEl.classList.add('disabled')
    }

    #enableSync() {
        this.#on = true
        this.#containerEl.classList.remove('disabled')
    }

    #allViewsHaveSameState() {
        for (let i = 1; i < this.#views.length; i++) {
            for (let j = 0; j < this.#views.length; j++) {
                if (i === j) continue

                if (!this.#views[i].equals(this.#views[j])) {
                    return false
                }
            }
        }

        return true
    }
}

export class BoardDemo {
    constructor(demosContainerEl) {
        const boardView1 = new BoardView(demosContainerEl, 'A')

        const syncButton1 = new SyncRealtimeButton(demosContainerEl)

        const boardView2 = new BoardView(demosContainerEl, 'B')

        syncButton1.addView(boardView1)
        syncButton1.addView(boardView2)

        /*
    
        const syncButton2 = new SyncButton(demosContainerEl)
    
        const boardView3 = new GCounterView(demosContainerEl, 'C')
    
        syncButton1.addCounterView(gCounterView1)
        syncButton1.addCounterView(gCounterView2)
    
        syncButton2.addCounterView(gCounterView2)
        syncButton2.addCounterView(gCounterView3)
        */
    }
}