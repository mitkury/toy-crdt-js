console.log('Start Toy Editor')

function div(inElement, callback) {
    return element('div', inElement, callback)
}

function span(inElement, callback) {
    return element('span', inElement, callback)
}

function element(tagName, inElement, callback) {
    const newEl = document.createElement(tagName)
    inElement.appendChild(newEl)
    callback && callback(newEl)
    return newEl
}

function nodeHasDataId(nodes) {
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].getAttribute('data-id')) {
            return true
        }
    }

    return false
}

class Editor extends EventTarget {

    static #mutationConfig = {
        //attributes: true,
        childList: true,
        subtree: true,
        characterData: true,
        attributeOldValue: true,
        characterDataOldValue: true,
    }

    editorEl = {}
    id = null
    counter = 0
    domElements = {}
    crdtNodes = {}
    operations = {}
    caret = null
    observer = null

    #isOnline = true

    getOnline() {
        return this.#isOnline
    }

    setOnline(value) {
        this.#isOnline = value

        this.dispatchEvent(new CustomEvent('online', {
            detail: {
                online: value,
                editorId: this.id
            }
        }))
    }

    constructor(inElement, id) {
        super()

        this.id = id

        div(inElement, containerEl => {
            containerEl.classList.add('editor')

            this.editorEl = div(containerEl, editorEl => {
                editorEl.classList.add('content')
                editorEl.setAttribute('id', id)
                editorEl.setAttribute('data-id', 'root')
                editorEl.setAttribute('contenteditable', 'true')
                editorEl.addEventListener('paste', this.#editorPasteHandle)
                editorEl.addEventListener('keydown', e => {
                    if (e.key === 'Enter') {
                        e.preventDefault()
                        // TODO: move to a separate function onNewLineCreations

                        // Create a paragraph after a symbol where the caret is
                        const selection = window.getSelection()
                        const anchorNode = selection.anchorNode

                        let anchorParentId;
                        // Text node (inside a node with 'data-id')
                        if (anchorNode.nodeType === 3) {
                            anchorParentId = anchorNode.parentNode.getAttribute('data-id')
                            // Node with 'data-id'
                        } else {
                            anchorParentId = anchorNode.getAttribute('data-id')
                        }

                        const anchorParentNode = this.crdtNodes[anchorParentId]
                        const targetParentId = anchorParentNode.parentId
                        const newBrId = this.#getNewOperationId()
                        const newSpanId = this.#getNewOperationId()
                        const ops = []
                        ops.push({
                            id: newBrId,
                            parentId: targetParentId,
                            leftId: anchorParentId,
                            rightId: newSpanId,
                            type: 'add',
                            tagName: 'br',

                        })
                        ops.push({
                            id: newSpanId,
                            parentId: targetParentId,
                            leftId: newBrId,
                            rightId: anchorParentNode.rightId,
                            type: 'add',
                            tagName: 'span',
                            // Insert 'zero width space' in the span. Otherwise the caret doesn't want to go into an element without a text node
                            text: '\u200B'
                        })

                        this.executeOperations(ops)

                        this.dispatchEvent(new CustomEvent('operationsExecuted', {
                            detail: {
                                editorId: this.id,
                                operations: ops
                            }
                        }))

                        // Put the caret inside the span element
                        const newAnchorNode = this.domElements[newSpanId]
                        selection.setBaseAndExtent(newAnchorNode, 1, newAnchorNode, 1)
                    }
                })
            })

            div(containerEl, controlsEl => {
                controlsEl.classList.add('controls')

                const checkbox = document.createElement('input')
                const checkboxId = this.id + '-online'
                checkbox.setAttribute('type', 'checkbox')
                checkbox.setAttribute('id', checkboxId)
                checkbox.setAttribute('checked', this.#isOnline)
                checkbox.addEventListener('change', e => {
                    this.setOnline(e.target.checked)
                })
                controlsEl.appendChild(checkbox)

                const label = document.createElement('label')
                label.textContent = 'online'
                label.setAttribute('for', checkboxId)
                controlsEl.appendChild(label)
            })
        })

        this.observer = new MutationObserver((mutations, observer) =>
            this.#editorMutateHandle(mutations, observer)
        )

        document.addEventListener('selectionchange', e => {
            if (!document.activeElement) {
                this.caret = null
                return
            }

            if (document.activeElement.getAttribute('id') != id) {
                return
            }

            const selection = window.getSelection()

            this.caret = {
                leftId: selection.anchorNode
            }
        })

        this.observeMutations()
    }

    observeMutations() {
        this.observer.observe(this.editorEl, Editor.#mutationConfig)
    }

    stopObservingMutations() {
        this.observer.disconnect()
    }

    executeOperations(ops) {
        const approvedOps = []
        for (var i = 0; i < ops.length; i++) {
            const op = ops[i]
            if (this.operations[op.id]) {
                continue
            }
            approvedOps.push(op)
        }

        this.stopObservingMutations()
        this.#executeOperationsUnsafe(approvedOps)
        this.observeMutations()
    }

    #editorMutateHandle(mutations, observer) {
        const editorEl = this.editorEl;

        this.stopObservingMutations()

        const ops = []

        const targetCaret = this.caret ? this.caret : {}

        for (var i = 0; i < mutations.length; i++) {
            let mutation = mutations[i]
            let target = mutation.target
            // A mutation on a tree of nodes: addition and romoval of nodes
            if (mutation.type == 'childList') {
                if (mutation.addedNodes.length > 0) {
                    for (var j = 0; j < mutation.addedNodes.length; j++) {
                        const node = mutation.addedNodes[j]
                        // Element
                        if (node.nodeType === 1) {
                            // Adding an element inside a span node
                            if (node.parentNode && node.parentNode.tagName === 'SPAN') {
                                // Put a new node outside of span that is used only for text node (a character)
                                const parentId = node.parentNode.getAttribute('data-id')
                                const targetParentId = this.crdtNodes[parentId].parentId
                                const newNodeId = this.#getNewOperationId()

                                ops.push({
                                    id: newNodeId,
                                    parentId: targetParentId,
                                    leftId: parentId,
                                    type: 'add',
                                    tagName: node.tagName,
                                })

                                targetCaret.leftId = newNodeId
                            }
                            // Adding an element in any other kind of node
                            else {
                                // We don't add a span that is empty or doesn't have crdtNodes
                                const makesSenseToAdd = node.tagName != 'SPAN' && node.parentNode && !nodeHasDataId(node.childNodes)

                                if (makesSenseToAdd) {
                                    const parentId = node.parentNode != editorEl ?
                                        node.parentNode.getAttribute('data-id') :
                                        'root'
                                    const newNodeId = this.#getNewOperationId()

                                    ops.push({
                                        id: newNodeId,
                                        parentId: parentId,
                                        type: 'add',
                                        tagName: node.tagName,

                                    })

                                    targetCaret.leftId = newNodeId
                                }
                            }

                            node.remove()
                        }
                        // Text
                        else if (node.nodeType === 3) {
                            if (node.parentNode.childNodes.length == 1) {
                                const opIdNewSpan = this.#getNewOperationId()
                                ops.push({
                                    id: opIdNewSpan,
                                    parentId: 'root',
                                    type: 'add',
                                    tagName: 'span',
                                    text: String(node.textContent)
                                })

                                targetCaret.leftId = opIdNewSpan

                                node.remove()
                            }
                        }
                    }

                }

                if (mutation.removedNodes.length > 0) {
                    for (var j = 0; j < mutation.removedNodes.length; j++) {
                        const node = mutation.removedNodes[j]
                        const targetId = node.getAttribute('data-id')
                        if (targetId) {
                            ops.push({
                                id: this.#getNewOperationId(),
                                targetId: targetId,
                                type: 'del'
                            })
                        } else {

                        }
                    }
                }

            }
            // A mutation on a CharacterData node (text was edited)
            else if (mutation.type == 'characterData' && mutation.target.parentNode) {
                const targetText = target.data
                const targetId = target.parentNode.getAttribute('data-id')

                // If editing a text node in one of the existing op nodes
                if (targetId != 'root') {
                    const parentId = target.parentNode.parentNode.getAttribute('data-id')
                    const prevText = mutation.oldValue

                    const selection = window.getSelection()
                    const anchorNode = selection.anchorNode
                    const anchorOffset = selection.anchorOffset

                    const insertOnTheRight = anchorNode == target && anchorOffset == target.length

                    const targetOp = this.operations[targetId]

                    const leftId = insertOnTheRight ? targetId : targetOp.leftId
                    const rightId = insertOnTheRight ? targetOp.rightId : targetId

                    if (targetText) {
                        if (targetText.length > prevText.length) {
                            const newText = targetText.replace(prevText, '')

                            const spanId = this.#getNewOperationId()
                            ops.push({
                                id: spanId,
                                parentId: parentId,
                                leftId: leftId,
                                rightId: rightId,
                                type: 'add',
                                tagName: 'span',
                                text: String(newText)
                            })

                            targetCaret.leftId = spanId

                            target.data = prevText
                        }
                    } else {
                        // TODO: delete?
                    }
                    // If editing a text node in the root
                } else {
                    const leftId = target.previousSibling ? target.previousSibling.getAttribute('data-id') : null
                    const rightId = target.nextSibling ? target.nextSibling.getAttribute('data-id') : null

                    const spanId = this.#getNewOperationId()
                    ops.push({
                        id: spanId,
                        parentId: 'root',
                        leftId: leftId,
                        rightId: rightId,
                        type: 'add',
                        tagName: 'span',
                        text: String(targetText)
                    })

                    targetCaret.leftId = spanId

                    target.remove()
                }
            }
        }

        this.#executeOperationsUnsafe(ops)

        this.observeMutations()

        this.dispatchEvent(new CustomEvent('operationsExecuted', {
            detail: {
                editorId: this.id,
                operations: ops
            }
        }))

        if (targetCaret.leftId) {
            const selection = window.getSelection()

            const nodeOnTheLeft = this.#getActualNodeOnTheLeft(targetCaret.leftId)

            if (nodeOnTheLeft) {
                const anchorNode = this.domElements[nodeOnTheLeft.id]
                selection.setBaseAndExtent(anchorNode, 1, anchorNode, 1)
            }
        }
    }

    #getNewOperationId() {
        const id = `${this.id}@${this.counter}`
        this.counter++
        return id
    }

    #getActualNodeOnTheLeft(nodeId) {
        if (!nodeId) {
            null
        }

        let targetNode = this.crdtNodes[nodeId]
        if (targetNode && targetNode.deleted) {
            if (targetNode.leftId) {
                return this.#getActualNodeOnTheLeft(targetNode.leftId)
            }

            return null
        }

        return targetNode
    }

    #executeOperationsUnsafe(ops) {
        const editorEl = this.editorEl;

        if (!ops || ops.length == 0) {
            return
        }

        for (var i = 0; i < ops.length; i++) {
            const op = ops[i]
            try {
                if (op.type == 'add') {
                    const parentEl = op.parentId === 'root' ? this.editorEl : this.domElements[op.parentId]
                    const leftEl = op.leftId ? this.domElements[op.leftId] : null
                    const rightEl = op.rightId ? this.domElements[op.rightId] : null

                    const newEl = element(op.tagName, editorEl)
                    newEl.setAttribute('data-id', op.id)
                    if (op.text) {
                        newEl.innerText = op.text
                    }
                    if (parentEl) {
                        if (rightEl) {
                            parentEl.insertBefore(newEl, rightEl)
                        }
                        else if (leftEl && leftEl.nextSibling) {
                            parentEl.insertBefore(newEl, leftEl.nextSibling)
                        } else {
                            parentEl.appendChild(newEl)
                        }
                    } else {
                        editorEl.appendChild(newEl)
                    }

                    this.domElements[op.id] = newEl

                    this.crdtNodes[op.id] = {
                        id: op.id,
                        parentId: op.parentId,
                        leftId: op.leftId,
                        rightId: op.rightId,
                        tagName: op.tagName,
                        text: String(op.text),
                        deleted: false,
                    }

                } else if (op.type == 'del') {
                    const element = this.domElements[op.targetId]
                    if (element) {
                        element.remove()
                        delete this.domElements[op.targetId]
                    }
                }

                this.operations[op.id] = op
            } catch (err) {
                console.error(`Couldn't execute operation - ${op.type} ${op.id} because of ${err}`)
            }

        }
    }

    #editorPasteHandle(e) {
        e.preventDefault()
    }
}

const mainContainerEl = document.getElementById('editors')

const editors = [
    new Editor(mainContainerEl, 'A'),
    new Editor(mainContainerEl, 'B'),
    new Editor(mainContainerEl, 'C'),
]

editors.forEach(editor => {
    editor.addEventListener('operationsExecuted', editorOperationsHandle)
    editor.addEventListener('online', editorSetOnlineHandle)
})

function editorOperationsHandle(event) {
    const executiveEditor = editors.find(editor => editor.id == event.detail.editorId)

    if (!executiveEditor.getOnline()) {
        return
    }

    editors.forEach(editor => {
        if (editor.id != executiveEditor && editor.getOnline()) {
            editor.executeOperations(event.detail.operations)
        }
    })
}

function editorSetOnlineHandle(event) {
    const { online, editorId } = event.detail

    // Handle the editor going back online
    if (!online) {
        return
    }

    const currentEditor = editors.find(editor => editor.id == editorId)

    // Sync changes from the editor that was online to its online peers
    {
        const ops = Object.values(currentEditor.operations)

        editors.forEach(editor => {
            if (editor.id != editorId) {
                editor.executeOperations(ops)
            }
        })
    }    

    // Sync changes from online peers to the editor that was offline
    {
        let opsSet = {}

        editors.forEach(editor => {
            if (editor.id != editorId) {
                opsSet = { ...editor.operations }
            }
        })

        const ops = Object.values(opsSet)
        
        currentEditor.executeOperations(ops)
    }

}