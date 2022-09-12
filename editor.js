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

class OpId {
    #peerId
    #counter

    static compare(opIdA, opIdB) {
        const counterA = opIdA.getCounter()
        const counterB = opIdB.getCounter()

        if (counterA > counterB) {
            return 1
        }
        else if (counterA < counterB) {
            return -1
        }
        else {
            const comparePeerId = opIdA.getPeerId().localeCompare(opIdB.getPeerId())
            return comparePeerId
        }
    }

    static equals(opIdA, opIdB) {
        if (opIdA == null && opIdB == null) {
            return true
        }
        else if (!opIdA || !opIdB) {
            return false
        }

        return OpId.compare(opIdA, opIdB) == 0
    }

    static tryParseStr(opIdStr) {
        if (!opIdStr) {
            return null
        }

        if (opIdStr == 'root') {
            return this.root()
        }

        const parts = opIdStr.split('@')

        if (parts.length != 2) {
            return null
        }

        return new OpId(parts[0], parts[1])
    }

    static root() {
        return new OpId(0, '')
    }

    constructor(counter, peerId) {
        this.#counter = counter
        this.#peerId = peerId
    }

    isRoot() {
        return this.#peerId === '' && this.#counter === 0
    }

    getPeerId() {
        return this.#peerId
    }

    getCounter() {
        return this.#counter
    }

    isGreaterThan(opId) {
        return OpId.compare(this, opId) == 1
    }

    toString() {
        if (this.isRoot()) {
            return 'root'
        }

        return this.#counter + '@' + this.#peerId
    }
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

    #isOnline = false

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

                        const selection = window.getSelection()
                        const anchorNode = selection.anchorNode
                        let anchorParentId

                        // Text node (inside a node with 'data-id')
                        if (anchorNode.nodeType === 3) {
                            anchorParentId = OpId.tryParseStr(anchorNode.parentNode.getAttribute('data-id'))
                            // Node with 'data-id'
                        } else {
                            anchorParentId = OpId.tryParseStr(anchorNode.getAttribute('data-id'))
                        }

                        let targetParentId

                        if (anchorParentId.isRoot()) {
                            targetParentId = anchorParentId
                        } else {
                            targetParentId = this.crdtNodes[anchorParentId].parentId

                            // In that case we insert the new line before the anchor
                            if (selection.anchorOffset == 0) {
                                if (anchorParentId) {
                                    let targetNode = this.crdtNodes[anchorParentId]
                                    while (true) {
                                        if (!targetNode.leftId) {
                                            targetNode = null
                                            break
                                        }

                                        targetNode = this.crdtNodes[targetNode.leftId]

                                        // If the node is deleted - we continue the search. 
                                        // Otherwise - we found the active node on the left
                                        if (!targetNode.deleted) {
                                            break
                                        }
                                    }

                                    anchorParentId = targetNode ? targetNode.id : null
                                }
                            }
                        }

                        const newBrId = this.#getNewOperationId()
                        const newSpanId = this.#getNewOperationId()
                        const ops = []
                        ops.push({
                            id: newBrId,
                            parentId: targetParentId,
                            leftId: anchorParentId,
                            //rightId: newSpanId,
                            type: 'add',
                            tagName: 'br',

                        })
                        ops.push({
                            id: newSpanId,
                            parentId: targetParentId,
                            leftId: newBrId,
                            //rightId: anchorParentNode.rightId,
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
                checkbox.checked = this.#isOnline
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
            this.#editorMutationHandle(mutations, observer)
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

    #editorMutationHandle(mutations, observer) {
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
                                const parentId = OpId.tryParseStr(node.parentNode.getAttribute('data-id'))
                                const targetParentId = this.crdtNodes[parentId].parentId
                                const newNodeId = this.#getNewOperationId()

                                ops.push({
                                    id: newNodeId,
                                    parentId: targetParentId,
                                    leftId: parentId,
                                    //rightId: null,
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
                                        OpId.tryParseStr(node.parentNode.getAttribute('data-id')) :
                                        OpId.root()
                                    const newNodeId = this.#getNewOperationId()

                                    ops.push({
                                        id: newNodeId,
                                        parentId: parentId,
                                        leftId: null,
                                        //rightId: null,
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
                                    leftId: null,
                                    //rightId: null,
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
                        const targetId = OpId.tryParseStr(node.getAttribute('data-id'))
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
                const targetId = OpId.tryParseStr(target.parentNode.getAttribute('data-id'))

                // If editing a text node in one of the existing op nodes
                if (!targetId.isRoot()) {
                    const parentId = OpId.tryParseStr(target.parentNode.parentNode.getAttribute('data-id'))
                    const prevText = mutation.oldValue

                    const selection = window.getSelection()
                    const anchorNode = selection.anchorNode
                    const anchorOffset = selection.anchorOffset

                    const insertOnTheRight = anchorNode == target && anchorOffset == target.length

                    const targetOp = this.operations[targetId]

                    const leftId = insertOnTheRight ? targetId : targetOp.leftId
                    //const rightId = insertOnTheRight ? targetOp.rightId : targetId

                    if (targetText) {
                        if (targetText.length > prevText.length) {
                            const newText = targetText.replace(prevText, '')

                            const spanId = this.#getNewOperationId()
                            ops.push({
                                id: spanId,
                                parentId: parentId,
                                leftId: leftId,
                                //rightId: rightId,
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

                }
                // If editing a text node in the root
                else {
                    const leftId = target.previousSibling ? OpId.tryParseStr(target.previousSibling.getAttribute('data-id')) : null
                    //const rightId = target.nextSibling ? OpId.tryParseStr(target.nextSibling.getAttribute('data-id')) : null

                    const spanId = this.#getNewOperationId()
                    ops.push({
                        id: spanId,
                        parentId: 'root',
                        leftId: leftId,
                        //rightId: rightId,
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
        this.counter++
        return new OpId(this.counter, this.id)
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

        for (var opi = 0; opi < ops.length; opi++) {
            const op = ops[opi]

            if (op.type == 'add') {
                const parentEl = op.parentId == 'root' ? this.editorEl : this.domElements[op.parentId]

                //const rightEl = op.rightId ? this.domElements[op.rightId] : null

                const nodesWithSameLeftId = []
                Object.values(this.crdtNodes).forEach(node => {
                    if (OpId.equals(node.leftId, op.leftId)) {
                        nodesWithSameLeftId.push(node)
                    }
                })

                // Sort from high to low. Highest ID goes in front
                nodesWithSameLeftId.sort((a, b) => {
                    return OpId.compare(b.id, a.id)
                })

                let targetLeftId = op.leftId

                // First find the origin leftId
                for (var i = 0; i < nodesWithSameLeftId.length; i++) {
                    const node = nodesWithSameLeftId[i]
                    // Given that we sorted from high to low (e.g 9,5,2,1,0)
                    // We take the first greatest ID as the target left
                    if (node.id.isGreaterThan(op.id)) {
                        targetLeftId = node.id
                    }
                }

                // Then find whether there's any other nodes relying on that ID.
                // In that case set target to the last node in the chain of nodes
                if (targetLeftId != null) {
                    const nodesAfterTargetLeftId = []
                    while (true) {
                        let found = false
                        Object.values(this.crdtNodes).forEach(node => {
                            if (OpId.equals(node.leftId, targetLeftId)) {
                                nodesAfterTargetLeftId.push(node)
                                targetLeftId = node.id
                                found = true
                            }
                        })
                        
                        if (!found) {
                            break
                        }
                    }
                    
                    if (nodesAfterTargetLeftId.length > 0) {
                        targetLeftId = nodesAfterTargetLeftId[nodesAfterTargetLeftId.length - 1].id
                    }
                }

                const leftEl = this.domElements[targetLeftId]

                const newEl = element(op.tagName, editorEl)
                newEl.setAttribute('data-id', op.id)

                if (op.text) {
                    newEl.innerText = op.text
                }
                if (parentEl) {
                    /*
                    if (rightEl) {
                        parentEl.insertBefore(newEl, rightEl)
                    }
                    else */
                    if (leftEl && leftEl.nextSibling) {
                        parentEl.insertBefore(newEl, leftEl.nextSibling)
                    } else {
                        parentEl.prepend(newEl)
                    }
                } else {
                    editorEl.appendChild(newEl)
                }

                this.domElements[op.id] = newEl

                this.crdtNodes[op.id] = {
                    id: op.id,
                    parentId: op.parentId,
                    leftId: op.leftId,
                    //rightId: op.rightId,
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
        if (editor.id != executiveEditor.id && editor.getOnline()) {
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

    // Sync changes from the editor that was offline to its online peers
    {
        const ops = Object.values(currentEditor.operations)

        editors.forEach(editor => {
            if (editor.id != editorId && editor.getOnline()) {
                editor.executeOperations(ops)
            }
        })
    }

    // Sync changes from online peers to the editor that was offline
    {
        let opsSet = {}

        editors.forEach(editor => {
            if (editor.id != editorId && editor.getOnline()) {
                opsSet = {
                    ...opsSet,
                    ...editor.operations
                }
            }
        })

        const ops = Object.values(opsSet)

        currentEditor.executeOperations(ops)
    }

}