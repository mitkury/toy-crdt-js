import { element, div, span, nodeHasDataId } from "/js/utils.js"
import { OpId } from "/js/crdt/opId.js"
import { ReplicatedTreeOfBlocks } from "/js/crdt/ReplicatedTreeOfBlocks.js"
import { EditorSegment } from "/js/editorSegment.js"
import { ActivationOperation, CreationOperation } from "/js/crdt/operations.js"
import { diff, NOOP, REPLACE, DELETE, INSERT } from "/js/myersDiff.js"

export class Editor extends EventTarget {

    #editorEl = {}
    #id = null
    #domElements = {}
    #caret = null
    #observer = null
    #isOnline = false
    replicatedBlocks = null
    #opsDidByClient = []
    #opsUndidByClient = []
    #ctrlIsPressed = false
    #editorSegment = null

    /**
     * @returns {OpId[]}
     */
    getId() {
        return this.#id
    }

    /**
    * @returns {Boolean}
    */
    getOnline() {
        return this.#isOnline
    }

    /**
    * @param {Boolean} value
    */
    setOnline(value) {
        this.#isOnline = value

        this.dispatchEvent(new CustomEvent('online', {
            detail: {
                online: value,
                editorId: this.#id
            }
        }))
    }

    /**
    * @param {HTMLElement} inElement
    * @param {String} id
    */
    constructor(inElement, id) {
        super()

        /**
         * @type {String}
         * @private
         */
        this.#id = id

        /**
         * @type {TextCrdt}
         * @private
         */
        this.replicatedBlocks = new ReplicatedTreeOfBlocks(id)

        div(inElement, containerEl => {
            containerEl.classList.add('editor')

            this.#editorEl = div(containerEl, editorEl => {
                editorEl.classList.add('content')
                editorEl.setAttribute('id', id)
                editorEl.setAttribute('data-id', 'root')
                editorEl.setAttribute('contenteditable', 'true')
                editorEl.setAttribute('spellcheck', 'true')
                editorEl.addEventListener('paste', e => this.#editorPasteHandle(e))
                editorEl.addEventListener('beforeinput', e => {
                    switch (e.inputType) {
                        // This will trigger because we do mutations and 
                        // the browser see a possibility to "undo" them
                        case "historyUndo": e.preventDefault(); this.undo(); break

                        // But this won't do anything as far as I know because we
                        // cancel "undo". So the browser won't see any possibility
                        // to do a "redo". But I keep this just in case
                        case "historyRedo": e.preventDefault(); this.redo(); break
                    }
                })
                editorEl.addEventListener('dragstart', e => {
                    // Haven't implemented an ability to correctly drag and drop, so let's
                    // prevent it for now
                    e.preventDefault()
                })
                editorEl.addEventListener('keydown', e => {
                    if (e.key == 'Control') {
                        this.#ctrlIsPressed = true
                    }

                    if (this.#ctrlIsPressed) {
                        // TODO: move to a separate function

                        // b
                        if (e.keyCode == 66) {
                            e.preventDefault()
                        }

                        // y // TODO: make it work on MacOS as expected
                        if (e.keyCode == 89) {
                            e.preventDefault()
                            this.redo()
                        }
                    }

                    if (e.key === 'Enter') {
                        e.preventDefault()

                        // TODO: move to a separate function onNewLineCreations   
                                             
                        /*
                        const anchorParentId = this.#getFirstSelectedNodeId()

                        // In that case we insert the new line before the anchor
                        if (selection.anchorOffset == 0 && anchorParentId) {
                            // Try to get the active node on the left
                            // If the element exists in the editor we assume
                            // it's active
                            let elementOnTheLeft = this.#domElements[anchorParentId].previousSibling
                            if (elementOnTheLeft != null) {
                                anchorParentId = elementOnTheLeft.getAttribute('data-id')
                            } else {
                                anchorParentId = OpId.root()
                            }
                        }
                        */

                        const newBrId = this.replicatedBlocks.getNewOperationId()
                        const newSpanId = this.replicatedBlocks.getNewOperationId()
                        const ops = []
                        ops.push(new CreationOperation.newLine(
                            newBrId,
                            anchorParentId,
                        ))
                        /*
                        ops.push(new CreationOperation(
                            newSpanId,
                            newBrId,
                            // Insert 'zero width space' in the span. Otherwise the caret 
                            // doesn't want to go into an element without a text node
                            '\u200B',
                            'span'
                        ))
                        */

                        this.executeOperations(ops)
                        this.#addOpIdsToArrayOfOpsDidByClient(ops)

                        this.dispatchEvent(new CustomEvent('operationsExecuted', {
                            detail: {
                                editorId: this.#id,
                                operations: ops
                            }
                        }))

                        /*
                        // Put the caret inside the span element
                        const newAnchorNode = this.#domElements[newSpanId]
                        selection.setBaseAndExtent(newAnchorNode, 1, newAnchorNode, 1)
                        */
                    }
                })
                editorEl.addEventListener('keyup', e => {
                    if (e.key == 'Control') {
                        this.#ctrlIsPressed = false
                    }
                })
            })

            div(containerEl, controlsEl => {
                controlsEl.classList.add('controls')

                const checkbox = document.createElement('input')
                const checkboxId = this.#id + '-online'
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

            this.#domElements[OpId.root()] = this.#editorEl
        })

        this.#observer = new MutationObserver((mutations, observer) =>
            this.#editorMutationHandle(mutations, observer)
        )

        document.addEventListener('selectionchange', e => {
            if (!document.activeElement) {
                this.#caret = null
                return
            }

            if (document.activeElement.getAttribute('id') != id) {
                return
            }

            const selection = window.getSelection()

            if (!selection.anchorNode) {
                return
            }

            /*
            // TODO: find the segment correctly
            const segment = this.#editorSegment
            if (segment) {
                const nodeId = segment.getNodeId(selection.anchorOffset)

                this.#caret = {
                    leftId: nodeId
                }
            }
            */
        })

        this.observeMutations()
    }

    /**
    * @param {OpId[]} ops
    */
    executeOperations(ops) {
        this.stopObservingMutations()
        this.#executeOperationsUnsafe(ops)
        this.observeMutations()

        this.#updateCaretPos()
    }

    /**
    * @returns {OpId[]}
    */
    getOperations() {
        return this.replicatedBlocks.getOperations()
    }

    static #mutationConfig = {
        childList: true,
        subtree: true,
        characterData: true,
        attributeOldValue: true,
        characterDataOldValue: true,
    }

    observeMutations() {
        this.#observer.observe(this.#editorEl, Editor.#mutationConfig)
    }

    stopObservingMutations() {
        this.#observer.disconnect()
    }

    #editorMutationHandle(mutations, observer) {
        const editorEl = this.#editorEl

        this.stopObservingMutations()

        const ops = []

        const targetCaret = this.#caret ? this.#caret : {}

        for (var i = 0; i < mutations.length; i++) {
            let mutation = mutations[i]
            let target = mutation.target
            // A mutation on a tree of nodes: addition and removal of nodes
            if (mutation.type == 'childList') {
                if (mutation.addedNodes.length > 0) {
                    for (var j = 0; j < mutation.addedNodes.length; j++) {
                        const node = mutation.addedNodes[j]
                        // Element
                        if (node.nodeType === 1) {
                            // Adding an element inside a span node
                            if (node.parentNode && node.parentNode.tagName === 'SPAN') {
                                // Put a new node outside of span that is used only for text node (a character)

                                /*
                                const leftId = OpId.tryParseStr(node.parentNode.getAttribute('data-id'))
                                const newNodeId = this.#textCrdt.getNewOperationId()

                                ops.push(new CreationOperation(
                                    newNodeId,
                                    leftId,
                                    null,
                                    node.tagName
                                ))

                                targetCaret.leftId = newNodeId
                                */
                            }
                            // Adding an element in any other kind of node
                            else {
                                // We don't add a span that is empty or doesn't have crdtNodes
                                const makesSenseToAdd = node.tagName != 'SPAN' && node && !nodeHasDataId(node.childNodes)

                                if (makesSenseToAdd) {
                                    /*
                                    const parentId = node.parentNode != editorEl ?
                                        OpId.tryParseStr(node.getAttribute('data-id')) :
                                        OpId.root()
                                    const newNodeId = this.#textCrdt.getNewOperationId()

                                    ops.push(new CreationOperation(
                                        newNodeId,
                                        parentId,
                                        null,
                                        node.tagName
                                    ))

                                    targetCaret.leftId = newNodeId
                                    */
                                }
                            }

                            node.remove()
                        }
                        // Text
                        else if (node.nodeType === 3) {
                            if (node.parentNode.childNodes.length == 1) {

                                // TODO: create a new segment

                                /*
                                const opIdNewSpan = this.#textCrdt.getNewOperationId()
                                ops.push(new CreationOperation(
                                    opIdNewSpan,
                                    'root',
                                    String(node.textContent),
                                    'span'
                                ))

                                targetCaret.leftId = opIdNewSpan

                                node.remove()
                                */
                            }
                        }
                    }
                }

                if (mutation.removedNodes.length > 0) {
                    for (var j = 0; j < mutation.removedNodes.length; j++) {
                        const node = mutation.removedNodes[j]

                        /*
                        const segmentId = node.getAttribute('data-sid')
                        if (segmentId) {
                            const segment = this.#editorSegment
                            for (let i = 0; i < segment.nodeIds.length; i++) {
                                const targetId = segment.nodeIds[i]
                                ops.push(new ActivationOperation(
                                    this.replicatedBlocks.getNewOperationId(),
                                    targetId,
                                    false
                                ))
                            }

                            this.#editorSegment = null
                        }
                        */
                    }
                }

            }
            // A mutation on a CharacterData node (text was edited)
            else if (mutation.type == 'characterData' && mutation.target.parentNode) {
                const parentEl = mutation.target.parentNode
                const nodeId = parentEl.getAttribute('data-nid')

                if (nodeId) {
                    const oldValue = mutation.oldValue
                    const newValue = mutation.target.data
                    
                    const editorSegment = this.#nodes[nodeId]
                    editorSegment.textContent = oldValue

                    const { insertions, deletions } = this.#processTextMutation(nodeId, oldValue, newValue)

                    for (let i = 0; i < deletions.length; i++) {
                        const blockId = deletions[i]
                        ops.push(new ActivationOperation(
                            this.replicatedBlocks.getNewOperationId(),
                            blockId,
                            false
                        ))

                        this.#caret = {
                            leftId: this.replicatedBlocks.blocks[blockId].parentId
                        }
                    }

                    for (let i = 0; i < insertions.length; i++) {
                        const value = insertions[i].value
                        let prevOpId = insertions[i].leftId

                        for (let charIdx = 0; charIdx < value.length; charIdx++) {
                            let char = value[charIdx]

                            const newOpId = this.replicatedBlocks.getNewOperationId()
                            const op = CreationOperation.newChar(
                                newOpId,
                                prevOpId,
                                char,
                            )
                            prevOpId = newOpId

                            this.#caret = {
                                leftId: newOpId
                            }

                            ops.push(op)
                        }
                    }

                    /*
                    editorSegment.getDiff(oldValue, newValue, (addedText, startIndex, targetLeftId, nodeIdsToDelete) => {
                        if (nodeIdsToDelete.length > 0) {
                            for (let i = 0; i < nodeIdsToDelete.length; i++) {
                                const nodeId = nodeIdsToDelete[i]

                                ops.push(new ActivationOperation(
                                    this.textCrdt.getNewOperationId(),
                                    nodeId,
                                    false
                                ))

                                this.#caret = {
                                    leftId: this.textCrdt.blocks[nodeId].parentId
                                }
                            }
                        }

                        let prevOpId = targetLeftId
                        if (addedText.length > 0) {
                            for (let i = 0; i < addedText.length; i++) {
                                let char = addedText[i]

                                const newOpId = this.textCrdt.getNewOperationId()
                                const op = new CreationOperation(
                                    newOpId,
                                    prevOpId,
                                    char,
                                )
                                prevOpId = newOpId

                                this.#caret = {
                                    leftId: newOpId
                                }

                                ops.push(op)
                            }
                        }
                    })
                    */
                } else {
                    const targetData = mutation.target.data
                    const segment = this.#editorSegment
                    let nodeLeftId = null
                    // Here we get targetLeftId from the last node of the previous segment
                    if (segment) {
                        nodeLeftId = OpId.root()
                    } else {
                        nodeLeftId = OpId.root()
                    }

                    const op = CreationOperation.newChar(
                        this.replicatedBlocks.getNewOperationId(),
                        nodeLeftId,
                        targetData,
                    )

                    target.remove()

                    ops.push(op)

                    this.#caret = {
                        leftId: nodeLeftId
                    }
                }
            }
        }


        this.#executeOperationsUnsafe(ops)
        this.#addOpIdsToArrayOfOpsDidByClient(ops)

        this.observeMutations()

        this.dispatchEvent(new CustomEvent('operationsExecuted', {
            detail: {
                editorId: this.#id,
                operations: ops
            }
        }))

        this.#updateCaretPos()
    }

    #getBlockIdFromContent(blockIds, contentIndex) {
        if (blockIds.length == 0) {
            return null
        }

        const blocks = this.replicatedBlocks.blocks

        if (contentIndex <= 0) {
            const firstNode = blocks[blockIds[0]]
            return firstNode.parentId
        }

        let contIdx = 0
        for (var i = 0; i < blockIds.length; i++) {
            const node = blocks[blockIds[i]]

            contIdx += node.text.length

            if (contIdx >= contentIndex) {
                return node.id
            }
        }

        return null
    }

    #processTextMutation(blockId, oldValue, newValue) {
        const changes = diff(oldValue, newValue);
        let sourceIndex = 0;
        let targetIndex = 0;
        let lastInsertionIdx = -2

        // Gather batches of insertions and deletions
        let insertions = []
        let deletions = []

        const blockIds = this.#blockInNodes[blockId]

        for (let i = 0, { length } = changes; i < length; i++) {
            switch (changes[i]) {
                case REPLACE:
                    // TODO: fix replacement
                    const blockId = this.#getBlockIdFromContent(blockIds, sourceIndex + 1)
                    deletions.push(blockId)

                    /*
                    insertions.push({
                        leftId: nodeId,
                        value: newValue[targetIndex]
                    })
                    */
                    {
                        let sourceInsertionIndex = targetIndex - 1
                        if (sourceInsertionIndex > oldValue.length - 1) {
                            sourceInsertionIndex = oldValue.length - 1
                        }

                        let insertion
                        if (i == lastInsertionIdx + 1) {
                            insertion = insertions[insertions.length - 1]
                        } else {
                            insertion = {
                                leftId: this.#getBlockIdFromContent(blockIds, sourceInsertionIndex + 1),
                                value: ""
                            }
                            insertions.push(insertion)
                        }
                        insertion.value += newValue[targetIndex]
                    }

                    lastInsertionIdx = i

                    sourceIndex++;
                    targetIndex++;
                    break;

                case NOOP:
                    sourceIndex++;
                    targetIndex++;
                    break;

                case DELETE:
                    deletions.push(this.#getBlockIdFromContent(blockIds, sourceIndex + 1))
                    sourceIndex++
                    break;

                case INSERT:
                    let sourceInsertionIndex = targetIndex - 1
                    if (sourceInsertionIndex > oldValue.length - 1) {
                        sourceInsertionIndex = oldValue.length - 1
                    }

                    let insertion
                    if (i == lastInsertionIdx + 1) {
                        insertion = insertions[insertions.length - 1]
                    } else {
                        insertion = {
                            leftId: this.#getBlockIdFromContent(blockIds, sourceInsertionIndex + 1),
                            value: ""
                        }
                        insertions.push(insertion)
                    }

                    insertion.value += newValue[targetIndex]
                    lastInsertionIdx = i

                    // Note: Do I need to increase sourceIndex as well
                    // when I insert within the source (not just appending)
                    targetIndex++;
                    break;
            }
        }

        console.log("Insertions and deletions:")
        console.log(insertions)
        console.log(deletions)

        return {
            insertions: insertions,
            deletions: deletions
        }
    }


    #getReverseOp(op) {
        let reverseOp = null

        if (op instanceof CreationOperation) {
            reverseOp = new ActivationOperation(
                this.replicatedBlocks.getNewOperationId(),
                op.getId(),
                false
            )
        } else if (op instanceof ActivationOperation) {
            if (op.isSetToActivate()) {
                reverseOp = new ActivationOperation(
                    this.replicatedBlocks.getNewOperationId(),
                    op.getTargetId(),
                    false
                )
            } else {
                reverseOp = new ActivationOperation(
                    this.replicatedBlocks.getNewOperationId(),
                    op.getTargetId(),
                    true
                )
            }
        }

        return reverseOp
    }

    undo() {
        if (this.#opsDidByClient.length == 0) {
            return
        }

        const opToUndo = this.replicatedBlocks.operations[this.#opsDidByClient.pop()]
        const reverseOp = this.#getReverseOp(opToUndo)
        this.#opsUndidByClient.push(reverseOp.getId())
        this.executeOperations([reverseOp])

        this.dispatchEvent(new CustomEvent('operationsExecuted', {
            detail: {
                editorId: this.#id,
                operations: [reverseOp]
            }
        }))
    }

    redo() {
        if (this.#opsUndidByClient.length == 0) {
            return
        }

        const opToRedo = this.replicatedBlocks.operations[this.#opsUndidByClient.pop()]
        const reverseOp = this.#getReverseOp(opToRedo)
        this.#opsDidByClient.push(reverseOp.getId())
        this.executeOperations([reverseOp])

        this.dispatchEvent(new CustomEvent('operationsExecuted', {
            detail: {
                editorId: this.#id,
                operations: [reverseOp]
            }
        }))
    }

    #nodeCounter = 0

    #createSpanNode() {
        const nodeEl = span(this.#editorEl)
        const nodeId = this.#nodeCounter
        this.#nodeCounter++
        nodeEl.setAttribute('data-nid', nodeId)
        this.#nodes[nodeId] = nodeEl
        this.#blockInNodes[nodeId] = []
        
        return nodeEl
    }

    #createSpanNodeAfterNode(nodeId) {
        const nodeOnTheLeftEl = this.#nodes[nodeId]
        const newNode = this.#createSpanNode(nodeId)
        this.editorEl.insertBefore(newNode, nodeOnTheLeftEl.nextSibling)
        
        return nodeEl
    }

    #nodes = {}
    #blockInNodes = {}
    #nodesWithBlocks = {}

    #addBlockToTextNode(nodeId, block, targetLeftId) {
        let [blockIndex, contentIndex] = this.#getNodeIndexAndContentIndex(nodeId, targetLeftId)
        blockIndex++
        contentIndex++

        this.#blockInNodes[nodeId].splice(blockIndex, 0, block.id)
        this.#nodesWithBlocks[block.id] = nodeId
        const nodeEl = this.#nodes[nodeId]
        const str = nodeEl.textContent

        nodeEl.textContent =
            str.slice(0, contentIndex) +
            block.text +
            str.slice(contentIndex)
    }

    #getNodeIndexAndContentIndex(nodeId, blockId) {
        const nodeIds = this.#blockInNodes[nodeId]
        let contentIndex = 0
        for (var i = 0; i < nodeIds.length; i++) {
            const node = this.replicatedBlocks.blocks[nodeIds[i]]

            if (OpId.equals(node.id, blockId)) {
                return [i, contentIndex]
            }

            contentIndex += node.text.length
        }

        return [-1, -1]
    }

    #executeOperationsUnsafe(ops) {
        const editorEl = this.#editorEl

        if (!ops || ops.length == 0) {
            return
        }

        this.replicatedBlocks.executeOperations(ops, (op, targetLeftBlockId) => {    
            if (op instanceof CreationOperation) {

                // Handle different types of blocks. For now, we only have text blocks
                // We will implement new line blocks soon and then may follow
                // with images, etc.

                // Find a suitable text node to insert a new character after
                let targetNode = null
                let targetIndexInNode = 0
                
                if (OpId.equals(targetLeftBlockId, OpId.root())) {                    
                    targetNode = editorEl.firstChild
                    targetIndexInNode = 0

                    if (!targetNode) {
                        targetNode = this.#createSpanNode()
                    }

                    const block = this.replicatedBlocks.blocks[op.getId()]
                    const nodeId = targetNode.getAttribute('data-nid')
                    this.#addBlockToTextNode(nodeId, block, targetLeftBlockId)
                } else {
                    const targetNodeId = this.#nodesWithBlocks[targetLeftBlockId]
                    const block = this.replicatedBlocks.blocks[op.getId()]
                    this.#addBlockToTextNode(targetNodeId, block, targetLeftBlockId)
                }

                //segment.addNode(op.getId(), targetLeftId)
            } else if (op instanceof ActivationOperation) {
                if (!op.isSetToActivate()) {
                    // TODO: implement removing
                    segment.removeNode(op.getTargetId())
                } else {
                    // TODO: impelemnt adding
                    segment.addNode(op.getTargetId(), targetLeftBlockId)
                }

            }
        })
    }

    #addOpIdsToArrayOfOpsDidByClient(ops) {
        // TODO: consider scoping those ops so it's possible to undo them in one go
        const opIds = ops.map(o => o.getId())
        this.#opsDidByClient.push(...opIds)

        this.#opsUndidByClient = []
    }

    #getTargetParentIdFromSelection() {
        let targetParentId = null

        const selection = window.getSelection()
        const anchorNode = selection.anchorNode

        // Text node (inside a node with 'data-id')
        if (anchorNode.nodeType === 3) {
            targetParentId = OpId.tryParseStr(anchorNode.parentNode.getAttribute('data-id'))

        }
        // Node with 'data-id' 
        else {
            targetParentId = OpId.tryParseStr(anchorNode.getAttribute('data-id'))
        }

        // In that case we insert the new line before the anchor
        if (selection.anchorOffset == 0 && targetParentId) {
            // Try to get the active node on the left
            // If the element exists in the editor we assume
            // it's active
            let elementOnTheLeft = this.#domElements[targetParentId].previousSibling
            if (elementOnTheLeft != null) {
                targetParentId = elementOnTheLeft.getAttribute('data-id')
            } else {
                targetParentId = OpId.root()
            }
        }

        return targetParentId
    }

    #getFirstSelectedNodeId() {
        // Get the selected text from the window
        var selection = window.getSelection();

        // If no text is selected, return null
        if (selection.rangeCount === 0) {
            return null
        }

        // Get the first range (there should only be one)
        var range = selection.getRangeAt(0)

        // If the selected range doesn't contain a text node, return null
        if (!range.startContainer.nodeType === Node.TEXT_NODE) {
            return null
        }

        return this.#editorSegment.getNodeId(range.startOffset)
    }   

    #getSelectedNodeIds() {
        // Get the selected text from the window
        var selection = window.getSelection();

        // If no text is selected, return null
        if (selection.rangeCount === 0) {
            return null;
        }

        // Get the first range (there should only be one)
        var range = selection.getRangeAt(0);

        // If the selected range doesn't contain a text node, return null
        if (!range.startContainer.nodeType === Node.TEXT_NODE) {
            return null;
        }

        const startContent = range.startOffset
        const endContent = range.endOffset

        return this.#editorSegment.getNodeIdsFromRange(startContent, endContent)
    }

    #editorPasteHandle(e) {
        e.preventDefault()

        /*
        let targetParentId = this.#getTargetParentIdFromSelection()
        if (targetParentId == null) {
            return
        }
        */

        const ops = []

        const selectedNodes = this.#getSelectedNodeIds()
        for (let i = 0; i < selectedNodes.length; i++) {
            const targetId = selectedNodes[i]
            ops.push(new ActivationOperation(
                this.replicatedBlocks.getNewOperationId(),
                targetId,
                false
            ))
        }

        let targetParentId = OpId.root()

        if (selectedNodes.length > 0) {
            targetParentId = selectedNodes[0]
        } else {
            targetParentId = this.#getFirstSelectedNodeId()
        }

        const pastedStr = e.clipboardData.getData('text/plain')
        for (let i = 0; i < pastedStr.length; i++) {
            const newOpId = this.replicatedBlocks.getNewOperationId()
            ops.push(new CreationOperation(
                newOpId,
                targetParentId,
                pastedStr[i],
                'span'
            ))

            targetParentId = newOpId
        }

        this.executeOperations(ops)
        this.#addOpIdsToArrayOfOpsDidByClient(ops)

        // TODO: refactor a bit
        this.#caret = {
            leftId: targetParentId
        }
        const targetCaret = this.#caret
        if (targetCaret.leftId) {
            const selection = window.getSelection()

            const nodeOnTheLeftId = this.replicatedBlocks.getActiveId(targetCaret.leftId)
            if (nodeOnTheLeftId) {
                const anchorNode = this.#domElements[nodeOnTheLeftId]
                selection.setBaseAndExtent(anchorNode, 1, anchorNode, 1)
            }
        }
    }

    #updateCaretPos() {
        const targetCaret = this.#caret
        if (targetCaret != null && targetCaret.leftId) {
            const segment = this.#editorSegment
            if (!segment) {
                return
            }

            let [_, contentIndex] = segment.getNodeIndexAndContentIndex(targetCaret.leftId)
            const textEl = segment.segmentEl.childNodes[0]
            const range = document.createRange();

            // Clamp contentIndex: [0, maxContentOffset]
            const maxContentOffset = textEl.textContent.length - 1
            contentIndex = Math.min(Math.max(contentIndex, 0), maxContentOffset);

            try {
                range.setStart(textEl, contentIndex + 1)
                range.collapse(true)
                const selection = window.getSelection()
                selection.removeAllRanges()
                selection.addRange(range)
            } catch (e) {
                console.error(e)
            }

        }
    }
}