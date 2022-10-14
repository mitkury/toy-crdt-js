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
                            type: 'add',
                            tagName: 'br',

                        })
                        ops.push({
                            id: newSpanId,
                            parentId: targetParentId,
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
                                const leftId = OpId.tryParseStr(node.parentNode.getAttribute('data-id'))
                                //const leftNode = this.crdtNodes[leftId]
                                //const rightId = leftNode.rightId ? this.crdtNodes[leftNode.rightId].id : null
                                //const targetParentId = leftNode.parentId
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

            const nodeOnTheLeftId = this.#getNonDeletedNodeIdFromLeft(targetCaret.leftId)

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

    #getNonDeletedNodeIdFromLeft(nodeId) {
        if (!nodeId) {
            return null
        }

        let targetNode = this.crdtNodes[nodeId]
        if (targetNode && targetNode.deleted) {
            if (targetNode.leftId) {
                return this.#getNonDeletedNodeIdFromLeft(targetNode.leftId)
            }

            return null
        }

        return targetNode ? targetNode.id : null
    }

    #getNonDeletedNodeIdFromRight(nodeId) {
        if (!nodeId) {
            return null
        }

        let targetNode = this.crdtNodes[nodeId]
        if (targetNode && targetNode.deleted) {
            if (targetNode.rightId) {
                return this.#getNonDeletedNodeIdFromRight(targetNode.rightId)
            }

            return null
        }

        return targetNode ? targetNode.id : null
    }

    #getActualLeftAndRightId_1(operation) {
        // TODO: let's switch to RGA. Let's look in the parent
        
        const parentNode = this.crdtNodes[operation.parentId]

        if (parentNode.childIds.length == 0) {

        }

        // TODO: find all of the children of parentNode and choose a node
        // to insert after

        console.log(operation)

        /*
        // Get a range between left and right ID
        // TODO: merge this with 'getSuitablePlaceInARange'
        const range = this.#getRangeBetweenLeftAndRightId_2(operation.leftId, operation.rightId)

        if (range.length == 0) {
            const leftNodeId = this.#getNonDeletedNodeIdFromLeft(operation.leftId)
            //const rightNodeId = leftNodeId != null ? this.#getNonDeletedNodeIdFromLeft(this.crdtNodes[leftNodeId].rightId) : null
            let rightNodeId = null
            if (leftNodeId != null) {
                rightNodeId = this.#getNonDeletedNodeIdFromLeft(this.crdtNodes[leftNodeId].rightId)
            } else {
                rightNodeId = this.#getNonDeletedNodeIdFromLeft(this.#headNodeId)
            }

            return [
                leftNodeId,
                rightNodeId
            ]
        }

        const leftAndRightIds = this.#getSuitablePlaceInARange_3(operation, range)

        // Find a suitable place in that range.
        // Skip deleted nodes and get the ones that are not deleted
        return [
            this.#getNonDeletedNodeIdFromLeft(leftAndRightIds[0]),
            this.#getNonDeletedNodeIdFromRight(leftAndRightIds[1])
        ]
        */
    }

    #getRangeBetweenLeftAndRightId_2(leftId, rightId) {
        const startNodeId = this.#getFirstNodeIdOnTheRightFromNode(leftId)

        if (!startNodeId || OpId.equals(startNodeId, rightId)) {
            return []
        }

        const range = []
        let node = this.crdtNodes[startNodeId]

        while (true) {
            range.push(node)

            if (OpId.equals(node.rightId, rightId)) {
                break
            }

            if (rightId != null && node.rightId == null) {
                console.error("Reached the end but couldn't find the rightId")
                break
            }

            node = this.crdtNodes[node.rightId]
        }

        return range
    }

    #getSortedChainsFromARange(range) {
        if (range.length == 0) {
            return []
        }

        if (range.length == 1) {
            return [{
                headId: range[0].id,
                tailId: range[0].id
            }]
        }

        const sortedChains = []

        let i = 0
        while (i < range.length) {
            const node = range[i]
 
            const pair = {
                headId: node.id,
                tailId: node.id
            }

            i++
            // Jump to a node that starts a new chain
            for (let j = i; j < range.length; j++) {
                const node = range[j]
                i = j

                if (!OpId.equals(node.originLeftId, node.leftId)) {
                    // Assign the tail of the chain
                    // Which is the last node in the chain
                    pair.tailId = range[j - 1].id
                    break
                }

                // If we reached the end
                if (i == range.length - 1) {
                    pair.tailId = node.id
                    // That should only mean that we reached the end. So let's break
                    // out of the outer 'while' loop by setting 'i' to highest number
                    i = Number.POSITIVE_INFINITY
                    break
                }

            }

            sortedChains.push(pair)
        }

        sortedChains.sort((a, b) => {
            return OpId.compare(a.headId, b.headId)
        })

        return sortedChains
    }

    #getSuitablePlaceInARange_3(operation, range) {
        // Account for chains (nodes inserted from left to right without interruptions)
        // Find the best place for a new node to be inserted

        let targetLeftId = operation.leftId
        let targetRightId = operation.rightId

        const sortedChains = this.#getSortedChainsFromARange(range)

        for (let i = 0; i < sortedChains.length; i++) {
            if (sortedChains[i].headId.isGreaterThan(operation.id)) {
                // TODO: consider, finding A and B between operation.id can be inserted
                // E.g 2 & 1, A and right-null
                targetLeftId = this.crdtNodes[sortedChains[i].headId].leftId
                break
            }

            //targetLeftId = sortedChains[i].tailId 
        }

        if (!targetLeftId && range.length > 0) {
            targetRightId = range[0].id
        }
        else if (targetLeftId) {
            targetRightId = this.crdtNodes[targetLeftId].rightId
        }

        return [targetLeftId, targetRightId]
    }

    #getFirstNodeIdOnTheRightFromNode(nodeId, outNodesWithSameOriginLeftId) {
        // First gather all of the nodes with the same ORIGIN left id
        let nodesWithSameOriginLeftId = []
        const nodes = Object.values(this.crdtNodes)
        for (let i = 0; i < nodes.length; i++) {
            if (OpId.equals(nodes[i].originLeftId, nodeId)) {
                nodesWithSameOriginLeftId.push(nodes[i])
            }
        }

        if (nodesWithSameOriginLeftId.length == 0) {
            return null
        }

        // Sort the nodes by their position from the left
        const nodesAndTheirPositonsFromTheLeft = []
        for (var i = 0; i < nodesWithSameOriginLeftId.length; i++) {
            let node = nodesWithSameOriginLeftId[i].leftId
            let amountOfNodesFromTargetLeftId = 0
            while (true) {
                if (node == null || node == nodeId) {
                    break
                }

                node = this.crdtNodes[node].leftId
                amountOfNodesFromTargetLeftId++
            }
            nodesAndTheirPositonsFromTheLeft.push({
                pos: amountOfNodesFromTargetLeftId,
                node: nodesWithSameOriginLeftId[i]
            })
        }

        nodesAndTheirPositonsFromTheLeft.sort((a, b) => {
            return a.pos - b.pos
        })

        nodesWithSameOriginLeftId = nodesAndTheirPositonsFromTheLeft.map(o => o.node)

        if (outNodesWithSameOriginLeftId) {
            if (Array.isArray(outNodesWithSameOriginLeftId)) {
                outNodesWithSameOriginLeftId.push(...nodesWithSameOriginLeftId)
            } else {
                console.error("Expected an array. Got something else")
            }
        }

        // Return the first node from that array. That is the node on the far left.
        return nodesWithSameOriginLeftId[0].id
    }

    #getLastNodeOnLeftFromNode(nodeId, outNodesWithSameOriginRightId) {
        let nodesWithSameOriginRightId = []
        const nodes = Object.values(this.crdtNodes)
        for (let i = 0; i < nodes.length; i++) {
            if (OpId.equals(nodes[i].originRightId, nodeId)) {
                nodesWithSameOriginRightId.push(nodes[i])
            }
        }

        if (nodesWithSameOriginRightId.length == 0) {
            return null
        }

        // Sort the nodes by their position from the left
        const nodesAndTheirPositonsFromTheRight = []
        for (var i = 0; i < nodesWithSameOriginRightId.length; i++) {
            let node = nodesWithSameOriginRightId[i].leftId
            let amountOfNodesFromTargetRightId = 0
            while (true) {
                if (node == null || node == nodeId) {
                    break
                }

                node = this.crdtNodes[node].rightId
                amountOfNodesFromTargetRightId++
            }
            nodesAndTheirPositonsFromTheRight.push({
                pos: amountOfNodesFromTargetRightId,
                node: nodesWithSameOriginRightId[i]
            })
        }

        nodesAndTheirPositonsFromTheRight.sort((a, b) => {
            return a.pos - b.pos
        })

        nodesWithSameOriginRightId = nodesAndTheirPositonsFromTheRight.map(o => o.node)

        if (outNodesWithSameOriginRightId) {
            if (Array.isArray(outNodesWithSameOriginRightId)) {
                outNodesWithSameOriginRightId.push(...nodesWithSameOriginRightId)
            } else {
                console.error("Expected an array. Got something else")
            }
        }

        // Return the first node from that array. That is the node on the far left.
        return nodesWithSameOriginRightId[0]
    }

    #getTailId(id) {
        const node = this.crdtNodes[id]
        if (node.childIds.length == 0) {
            return id
        }

        return this.#getTailId(node.childIds[node.childIds.length - 1])
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
            // So newer nodes can be inserted in front of old nodes.
            const newOpCounter = op.id.getCounter()
            if (newOpCounter > this.counter) {
                this.counter = newOpCounter
            }

            if (op.type == 'add') {

                // First make sure that needed nodes already exist. If not then 
                // save the operation for later, when a node appears
                /* TODO: refactor to make it work with RGA
                if (op.parentId != 'root' && !this.crdtNodes.hasOwnProperty(op.parentId)) {
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
                */

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

                if (targetLeftId == OpId.root()) {
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

                // TODO: find a target non deleted left id
                // First check thether targetLeftIs deleted
                // If it's then look at the parent
                // If the parent is not deleted then take a look at all of the
                // adjacent child ids on the left and find the one that is not deleted
                // or get the paret if all of the elements are deleted
                // If the parent itself is deleted, then do the same thing from the above
                // with the parent of the parent started with its tail

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

                if (this.#opsWithMissingLeftId.hasOwnProperty(op.id)) {
                    const ops = this.#opsWithMissingLeftId[op.id]
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

        //shuffleArray_Test(ops)

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

        //shuffleArray_Test(ops)

        currentEditor.executeOperations(ops)
    }

}