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
        if (opIdA instanceof OpId === false) {
            opIdA = OpId.tryParseStr(opIdA)
        }
        if (opIdB instanceof OpId === false) {
            opIdB = OpId.tryParseStr(opIdB)
        }

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
    #headNodeId = null
    #tailNodeId = null
    #opsWithMissingLeftId = {}
    #opsWithMissingParentId = {}
    #delOpsWithMissingTargetId = {}
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

                        }
                        // Node with 'data-id' 
                        else {
                            anchorParentId = OpId.tryParseStr(anchorNode.getAttribute('data-id'))
                        }

                        // In that case we insert the new line before the anchor
                        if (selection.anchorOffset == 0 && anchorParentId) {
                            // Try to get the non-deleted node on the left
                            // If the element exists in the editor we assume
                            // it's not deleted
                            let elementOnTheLeft = this.domElements[anchorParentId].previousSibling
                            if (elementOnTheLeft != null) {
                                anchorParentId = this.crdtNodes[elementOnTheLeft.getAttribute('data-id')]
                            } else {
                                anchorParentId = OpId.root()
                            }
                        }


                        const newBrId = this.#getNewOperationId()
                        const newSpanId = this.#getNewOperationId()
                        const ops = []
                        ops.push({
                            id: newBrId,
                            parentId: anchorParentId,
                            type: 'add',
                            tagName: 'br',

                        })
                        ops.push({
                            id: newSpanId,
                            parentId: newBrId,
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

            this.crdtNodes[OpId.root()] = {
                id: OpId.root(),
                parentId: null,
                childIds: [],
                tagName: 'div',
                text: null,
                deleted: false,
            }

            this.domElements[OpId.root()] = this.editorEl
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

            let node = null
            if (selection.anchorNode.nodeType === 3) {
                node = selection.anchorNode.parentNode
            } else {
                node = selection.anchorNode
            }

            this.caret = {
                leftId: node.getAttribute('data-id')
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
                                const leftId = OpId.tryParseStr(node.parentNode.getAttribute('data-id'))
                                const newNodeId = this.#getNewOperationId()

                                ops.push({
                                    id: newNodeId,
                                    parentId: leftId,
                                    type: 'add',
                                    tagName: node.tagName,
                                })

                                targetCaret.leftId = newNodeId
                            }
                            // Adding an element in any other kind of node
                            else {
                                // We don't add a span that is empty or doesn't have crdtNodes
                                const makesSenseToAdd = node.tagName != 'SPAN' && node && !nodeHasDataId(node.childNodes)

                                if (makesSenseToAdd) {
                                    const parentId = node.parentNode != editorEl ?
                                        OpId.tryParseStr(node.getAttribute('data-id')) :
                                        OpId.root()
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
                const initNodeId = OpId.tryParseStr(target.parentNode.getAttribute('data-id'))

                // If editing a text node in one of the existing op nodes
                if (!initNodeId.isRoot()) {

                    const prevText = mutation.oldValue

                    if (targetText) {
                        if (targetText.length > prevText.length) {
                            const newText = targetText.replace(prevText, '')
                            let parentId = initNodeId

                            const selection = window.getSelection()
                            const anchorNode = selection.anchorNode
                            const anchorOffset = selection.anchorOffset

                            // Detect if we inseted from the left. 
                            // It may happen when we type backwards.
                            // In that case assign a target parentId 
                            // to the initNode's parent.
                            const insertOnTheRight = anchorNode == target && anchorOffset == target.length
                            if (!insertOnTheRight) {
                                parentId = this.crdtNodes[initNodeId].parentId
                            }

                            const spanId = this.#getNewOperationId()
                            ops.push({
                                id: spanId,
                                parentId: parentId,
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
                    const rightId = target.nextSibling ? OpId.tryParseStr(target.nextSibling.getAttribute('data-id')) : null

                    const spanId = this.#getNewOperationId()
                    ops.push({
                        id: spanId,
                        parentId: 'root',
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

            const nodeOnTheLeftId = this.#getNonDeletedLeftId(targetCaret.leftId)
            if (nodeOnTheLeftId) {
                const anchorNode = this.domElements[nodeOnTheLeftId]
                selection.setBaseAndExtent(anchorNode, 1, anchorNode, 1)
            }
        }
    }

    #getNewOperationId() {
        this.counter++
        return new OpId(this.counter, this.id)
    }

    #getTailId(id) {
        const node = this.crdtNodes[id]
        if (node.childIds.length == 0) {
            return id
        }

        return this.#getTailId(node.childIds[node.childIds.length - 1])
    }

    #getNonDeletedTailNode(id, startAfterId) {
        const node = this.crdtNodes[id]

        let nonDeletedChildNode = null
        let startLookingInChildren = startAfterId ? false : true

        for (let i = node.childIds.length - 1; i >= 0; i--) {
            const childNode = this.crdtNodes[node.childIds[i]]

            if (startLookingInChildren) {
                // Go down and look for a tail non deleted child node.
                // We do it recursively till we find the tail
                nonDeletedChildNode = this.#getNonDeletedTailNode(node.childIds[i], null)
                if (nonDeletedChildNode != null) {
                    break
                }
            }
            else if (startAfterId && OpId.equals(childNode.id, startAfterId)) {
                startLookingInChildren = true
            }
        }

        if (nonDeletedChildNode == null && !node.deleted) {
            // Return the tail that is not deleted
            return node
        }
        else if (nonDeletedChildNode == null && node.parentId != null) {
            // Go up because we haven't got a non-deleted tail node yet
            return this.#getNonDeletedTailNode(node.parentId, node.id)
        }
        else {
            // Return a non-deleted tail child node. That is the final step.
            // We ether have a node or null here
            return nonDeletedChildNode
        }
    }

    /**
     * Find a target non deleted left id. It goes left until it finds a non-deleted node
     */
    #getNonDeletedLeftId(id) {
        if (!id) {
            return null
        }

        const node = this.crdtNodes[id]
        if (!node.deleted) {
            return id
        }

        if (!node.parentId) {
            return null
        }

        const nonDeletedTail = this.#getNonDeletedTailNode(node.parentId, id)
        return nonDeletedTail ? nonDeletedTail.id : null
    }


    #executeOperationsUnsafe(ops) {
        const editorEl = this.editorEl;

        if (!ops || ops.length == 0) {
            return
        }

        for (var opi = 0; opi < ops.length; opi++) {
            const op = ops[opi]

            // Increase the local counter if the op's counter is larger.
            // We do it because we use the counter as a 'Lamport timestamp'
            // to insert nodes in a desirable order.
            // So newer nodes can be inserted in front of old nodes, eg.
            // any time we insert something in between of nodes
            const newOpCounter = op.id.getCounter()
            if (newOpCounter > this.counter) {
                this.counter = newOpCounter
            }

            if (op.type == 'add') {

                // First make sure that needed nodes already exist. If not then 
                // save the operation for later, when a node appears
                if (!this.crdtNodes.hasOwnProperty(op.parentId)) {
                    let arr = []
                    if (this.#opsWithMissingParentId.hasOwnProperty(op.parentId)) {
                        arr = this.#opsWithMissingParentId[op.parentId]
                    }
                    arr.push(op)
                    this.#opsWithMissingParentId[op.parentId] = arr
                    continue
                }

                if (op.leftId != null && !this.crdtNodes.hasOwnProperty(op.leftId)) {
                    let arr = []
                    if (this.#opsWithMissingLeftId.hasOwnProperty(op.leftId)) {
                        arr = this.#opsWithMissingLeftId[op.leftId]
                    }
                    arr.push(op)

                    this.#opsWithMissingLeftId[op.leftId] = arr

                    continue
                }


                let targetLeftId = null
                let indexOfInsertion = 0
                const parentNode = this.crdtNodes[op.parentId]
                const childIds = parentNode.childIds

                if (childIds.length > 0) {
                    targetLeftId = op.parentId

                    indexOfInsertion = 0
                    // Find an appropriate ID and index to insert after
                    for (let i = 0; i < childIds.length; i++) {
                        const childId = childIds[i]
                        if (op.id.isGreaterThan(childId)) {
                            break
                        }

                        targetLeftId = childId
                        indexOfInsertion++
                    }

                    if (indexOfInsertion > 0) {
                        // Insert at the tail of the targetLeftId because the target
                        // may have its own children
                        targetLeftId = this.#getTailId(targetLeftId)
                    }
                } else {
                    targetLeftId = op.parentId
                }

                if (OpId.equals(targetLeftId, OpId.root())) {
                    targetLeftId = null
                }

                parentNode.childIds.splice(indexOfInsertion, 0, op.id)

                this.crdtNodes[op.id] = {
                    id: op.id,
                    parentId: op.parentId,
                    childIds: [],
                    tagName: op.tagName,
                    text: String(op.text),
                    deleted: false,
                }


                const newEl = element(op.tagName, editorEl)
                newEl.setAttribute('data-id', op.id)

                if (op.text) {
                    newEl.innerText = op.text
                }

                targetLeftId = this.#getNonDeletedLeftId(targetLeftId)

                const actualRoot = this.editorEl
                const leftEl = targetLeftId ? this.domElements[targetLeftId] : null

                if (leftEl && leftEl.nextSibling) {
                    actualRoot.insertBefore(newEl, leftEl.nextSibling)
                } else {
                    actualRoot.prepend(newEl)
                }

                this.domElements[op.id] = newEl


                if (this.#opsWithMissingParentId.hasOwnProperty(op.id)) {
                    const ops = this.#opsWithMissingParentId[op.id]
                    if (ops && ops.length > 0) {
                        this.#executeOperationsUnsafe(ops)
                    }
                }

                if (this.#delOpsWithMissingTargetId.hasOwnProperty(op.id)) {
                    const ops = this.#delOpsWithMissingTargetId[op.id]
                    if (ops && ops.length > 0) {
                        this.#executeOperationsUnsafe(ops)
                    }
                }
            } else if (op.type == 'del') {
                if (!this.crdtNodes.hasOwnProperty(op.targetId)) {
                    let arr = []
                    if (this.#delOpsWithMissingTargetId.hasOwnProperty(op.targetId)) {
                        arr = this.#delOpsWithMissingTargetId[op.targetId]
                    }
                    arr.push(op)

                    this.#delOpsWithMissingTargetId[op.targetId] = arr

                    continue
                }

                const node = this.crdtNodes[op.targetId]
                node.deleted = true

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

function shuffleArray_Test(array) {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
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

        shuffleArray_Test(ops)

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

        shuffleArray_Test(ops)

        currentEditor.executeOperations(ops)
    }

}