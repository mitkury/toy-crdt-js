import { element, div } from "/js/utils.js" 
import { OpId } from "/js/crdt/opId.js"
import { ReplicatedTreeOfBlocks } from "/js/crdt/replicatedTreeOfBlocks.js"
import { ActivationOperation, CreationOperation } from "/js/crdt/operations.js"
import { diff, NOOP, REPLACE, DELETE, INSERT } from "/js/text/myersDiff.js"

export class Editor extends EventTarget {

    #editorEl = {}
    #id = null
    #domElements = {}
    #caret = null
    #observer = null
    #isOnline = true
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
                        // the browser sees a possibility to "undo" them
                        case "historyUndo": e.preventDefault(); this.undo(); break

                        // But this won't do anything as far as I know because we
                        // cancel "undo" (e.preventDefault()). So the browser won't see any possibility
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

                        let targetParentBlockId = this.#getFirstSelectedBlockId()

                        const isTargetBlockAParagraph = this.replicatedBlocks.blocks[targetParentBlockId].type == 2

                        if (isTargetBlockAParagraph) {
                            const blocksInTargetParagraph = this.#blocksInNodes[targetParentBlockId]

                            // In this case we're going to create a new paragraph
                            // in front of the target paragraph, not after.
                            // It means that the caret is at the beginning of the paragraph
                            if (blocksInTargetParagraph.length > 0) {
                                const targetParagraphNode = this.#nodes[targetParentBlockId]

                                const prevSiblingNode = targetParagraphNode.previousSibling

                                if (prevSiblingNode != null) {
                                    targetParentBlockId = prevSiblingNode.getAttribute('data-id')

                                    blocksInPrevNode = this.#blocksInNodes[targetParentBlockId]

                                    if (blocksInPrevNode.length > 0) {
                                        targetParentBlockId = blocksInPrevNode[blocksInPrevNode.length - 1]
                                    }
                                }
                                else {
                                    targetParentBlockId = OpId.root()
                                }
                            }
                        }

                        const paragraphId = this.replicatedBlocks.getNewOperationId()
                        const ops = []

                        ops.push(CreationOperation.newParagraph(paragraphId, targetParentBlockId))

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

    /**
     * This function is called when the editor element is mutated
     * by the browser. We roll back the mutations and re-apply those that we 
     * support using operations.
     * @param {MutationRecord[]} mutations
     * @param {MutationObserver} observer
     */
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
                        // Remove any node automatically created by the browser 
                        // aside from text nodes (nodeType == 3)
                        // We need a text node present so we can detect the 
                        // parent node where the node was created to insert
                        // a text node with the same content using an operation
                        // We will use that node with the next mutation (characterData)
                        // that follows after creation of the node
                        if (node.nodeType !== 3) {
                            node.remove()
                        }
                    }
                }

                if (mutation.removedNodes.length > 0) {
                    for (var j = 0; j < mutation.removedNodes.length; j++) {
                        const node = mutation.removedNodes[j]

                        if (node.nodeType == '3') {
                            const paragraphElId = mutation.target.getAttribute('data-nid')
                            const blocksInParagraph = this.#blocksInNodes[paragraphElId]
                            const blockIdsToDelete = [paragraphElId, ...blocksInParagraph]

                            for (let i = 0; i < blockIdsToDelete.length; i++) {
                                const targetId = blockIdsToDelete[i]
                                ops.push(new ActivationOperation(
                                    this.replicatedBlocks.getNewOperationId(),
                                    targetId,
                                    false
                                ))
                            }
                        }

                        //const nodeId = node.getAttribute('data-sid')

                        // TODO: create the node removal operation
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
            else if (mutation.type == 'characterData') {
                const parentEl = mutation.target.parentNode
                const nodeId = parentEl ? parentEl.getAttribute('data-nid') : null

                // Inide the node
                if (nodeId) {
                    const oldValue = mutation.oldValue
                    const newValue = mutation.target.data

                    const nodeEl = this.#nodes[nodeId]
                    // Set the old value back to the node. We will edit 
                    // the node though an operation otherwise we will
                    // get into an incorrect state.
                    nodeEl.textContent = oldValue

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
                }
                // Outside of the node
                else if (parentEl != null) {
                    // As long as we have a parent element, 
                    // we can create a new paragraph and insert the text there.
                    // It's the first thing we do when a user edits the 
                    // empty editor that doesn't have any paragraph nodes.

                    const targetData = mutation.target.data
                    const blockLeftId = OpId.root()

                    const paragraphId = this.replicatedBlocks.getNewOperationId()
                    ops.push(CreationOperation.newParagraph(paragraphId, blockLeftId))
                    const newCharBlockId = this.replicatedBlocks.getNewOperationId()
                    ops.push(CreationOperation.newChar(
                        newCharBlockId,
                        paragraphId,
                        targetData,
                    ))

                    target.remove()

                    this.#caret = {
                        leftId: newCharBlockId
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

    #getBlockIdFromContent(blockId, contentIndex) {
        const blockIds = this.#blocksInNodes[blockId]

        if (blockIds.length == 0) {
            return blockId
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

    #getBlockIndexAndContentIndex(containerBlockId, targetBlockId) {
        const blockIds = this.#blocksInNodes[containerBlockId]

        let contentIndex = 0
        for (var i = 0; i < blockIds.length; i++) {
            const block = this.replicatedBlocks.blocks[blockIds[i]]

            if (OpId.equals(block.id, targetBlockId)) {
                return [i, contentIndex]
            }

            contentIndex += block.text.length
        }

        return [-1, -1]
    }

    #removeBlockIdsFromContainerStartingAtBlockId(containerBlockId, blockId) {
        const blockIds = this.#blocksInNodes[containerBlockId]

        let index = -1
        for (let i = 0; i < blockIds.length; i++) {
            if (OpId.equals(blockIds[i], blockId)) {
                index = i + 1
                break
            }
        }

        if (index == -1) {
            return
        }

        const removedBlockIds = blockIds.splice(index)
        //this.#blocksInNodes[containerBlockId].splice(index)

        for (let i = 0; i < removedBlockIds.length; i++) {
            const blockId = removedBlockIds[i]
            delete this.#nodesWithBlocks[blockId]
        }

        return removedBlockIds
    }

    #processTextMutation(targetContainerBlockId, oldValue, newValue) {
        const changes = diff(oldValue, newValue)
        let sourceIndex = 0
        let targetIndex = 0
        let lastInsertionIdx = -2

        // Gather batches of insertions and deletions
        let insertions = []
        let deletions = []

        for (let i = 0, { length } = changes; i < length; i++) {
            switch (changes[i]) {
                case REPLACE:
                    // TODO: fix replacement
                    const blockId = this.#getBlockIdFromContent(targetContainerBlockId, sourceIndex + 1)
                    deletions.push(blockId)

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
                                leftId: this.#getBlockIdFromContent(targetContainerBlockId, sourceInsertionIndex + 1),
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
                    deletions.push(this.#getBlockIdFromContent(targetContainerBlockId, sourceIndex + 1))
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
                            leftId: this.#getBlockIdFromContent(targetContainerBlockId, sourceInsertionIndex + 1),
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

    /*
    #createSpanNode() {
        const nodeEl = span(this.#editorEl)
        const nodeId = this.#nodeCounter
        this.#nodeCounter++
        this.#nodes[nodeId] = nodeEl
        this.#blockInNodes[nodeId] = []
        
        return nodeEl
    }
    */

    #createNode(tag, blockId, nodeIdOnTheLeft) {
        const newNodeEl = element(tag, this.#editorEl)
        //const newNodeId = this.#nodeCounter
        //this.#nodeCounter++
        newNodeEl.setAttribute('data-nid', blockId)
        this.#nodes[blockId] = newNodeEl
        this.#blocksInNodes[blockId] = []
        this.#nodesWithBlocks[blockId] = blockId

        if (tag == 'p') {
            const textNode = document.createTextNode('')
            const brNode = document.createElement("br")
            newNodeEl.appendChild(textNode)
            newNodeEl.appendChild(brNode)
        }

        if (nodeIdOnTheLeft != null) {
            const nodeOnTheLeftEl = this.#nodes[nodeIdOnTheLeft]
            this.#editorEl.insertBefore(newNodeEl, nodeOnTheLeftEl.nextSibling)

        }
        // When it's null, we need to insert the new node at the beginning
        else {
            const firstChild = this.#editorEl.firstChild
            if (firstChild) {
                this.#editorEl.insertBefore(newNodeEl, firstChild)
            } else {
                this.#editorEl.appendChild(newNodeEl)
            }
        }

        return { newNodeEl, newNodeId: blockId }
    }

    #createParagraphNode(blockId, nodeIdOnTheLeft) {
        return this.#createNode('p', blockId, nodeIdOnTheLeft)
    }

    #createNewLineNode(blockId, nodeIdOnTheLeft) {
        return this.#createNode('br', blockId, nodeIdOnTheLeft)
    }

    #nodes = {}
    #blocksInNodes = {}
    #nodesWithBlocks = {}

    #addBlockToTextNode(nodeId, block, targetLeftId) {
        let [blockIndex, contentIndex] = this.#getNodeIndexAndContentIndex(nodeId, targetLeftId)
        blockIndex++
        contentIndex++

        this.#blocksInNodes[nodeId].splice(blockIndex, 0, block.id)
        this.#nodesWithBlocks[block.id] = nodeId

        const nodeEl = this.#nodes[nodeId]
        const str = nodeEl.textContent
        nodeEl.textContent =
            str.slice(0, contentIndex) +
            block.text +
            str.slice(contentIndex)
    }

    #removeBlockFromTextNode(blockId) {
        const nodeId = this.#nodesWithBlocks[blockId]
        const block = this.replicatedBlocks.blocks[blockId]
        const [blockIndex, contentIndex] = this.#getNodeIndexAndContentIndex(nodeId, blockId)
        this.#blocksInNodes[nodeId].splice(blockIndex, 1)
        delete this.#nodesWithBlocks[blockId]

        const nodeEl = this.#nodes[nodeId]
        const str = nodeEl.textContent
        nodeEl.textContent =
            str.slice(0, contentIndex) +
            str.slice(contentIndex + block.text.length)
    }

    #addBlockToNewLineNode(nodeId, block) {
        this.#blocksInNodes[nodeId] = [block.id]
        this.#nodesWithBlocks[block.id] = nodeId
    }

    #getNodeIndexAndContentIndex(nodeId, blockId) {
        const nodeIds = this.#blocksInNodes[nodeId]
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

                const block = this.replicatedBlocks.blocks[op.getId()]
                const newBlockIsChar = op.getType() == 0
                const newBlockIsNewline = op.getType() == 1
                const newBLockIsParagraph = op.getType() == 2
                let targetNodeId = null

                if (OpId.equals(targetLeftBlockId, OpId.root())) {
                    if (newBlockIsChar) {
                        let targetNode = editorEl.firstChild
                        targetNodeId = targetNode.getAttribute('data-nid')
                    }
                } else {
                    targetNodeId = this.#nodesWithBlocks[targetLeftBlockId]
                }

                if (newBlockIsChar) {
                    // If targetLeftBlockId is a new line block
                    // then we need to create a new span node after the 
                    // new line node
                    const leftBlock = this.replicatedBlocks.blocks[targetLeftBlockId]
                    if (leftBlock.type == 1) {
                        const { newNodeId } = this.#createParagraphNode(targetNodeId)
                        targetNodeId = newNodeId
                    }

                    this.#addBlockToTextNode(targetNodeId, block, targetLeftBlockId)
                } else if (newBlockIsNewline) {
                    const { newNodeId: newlineNodeId } = this.#createNewLineNode(block.id, targetNodeId)
                    this.#addBlockToNewLineNode(newlineNodeId, block)

                    // Detect if a node needs to be splitted
                    // if the insertion point is in the middle of a text node
                    // Gather blockIds from the node starting from block.id
                    // Move the blockIds to the new node
                    // Update the node's text content
                    const blockIdsToSplit = this.#getBlockIdsFromNode(targetNodeId, targetLeftBlockId, null)
                    if (blockIdsToSplit.length > 0) {
                        const { newNodeId: newSpanNodeId } = this.#createParagraphNode(newlineNodeId)
                        this.#moveBlocksFromNodeToNode(targetNodeId, newSpanNodeId, blockIdsToSplit)
                    }
                }
                else if (newBLockIsParagraph) {
                    const { newNodeId } = this.#createParagraphNode(block.id, targetNodeId)

                    // TODO: account for a paragraph inserted in the middle of a text node
                    // 1. Get the prev paragraph
                    // 2. Remove the blockIds from the prev paragraph
                    // 3. Put the blockIds in the new paragraph
                    // 4. Re-draw both paragraphs
                    /*
                    // Remove all the splitted blockIds from the target paragraph
                    const targetParagraphId = this.#getSelectedParagraphId()
                    this.#removeBlockIdsFromContainerStartingAtBlockId(targetParagraphId, targetParentBlockId)
                    */
                }
                else {
                    throw new Error('Unknown block type')
                }
            } else if (op instanceof ActivationOperation) {
                if (!op.isSetToActivate()) {
                    // TODO: implement removing of paragraps

                    this.#removeBlockFromTextNode(op.getTargetId())

                } else {
                    // TODO: impelemnt adding
                    segment.addNode(op.getTargetId(), targetLeftBlockId)
                }

            }
        })
    }

    #getBlockIdsFromNode(nodeId, startBlockId, endBlockId) {
        const blockIds = this.#blocksInNodes[nodeId]

        try {
            const startBlockIndex = blockIds.indexOf(startBlockId) + 1
            const endBlockIndex = endBlockId ? blockIds.indexOf(endBlockId) + 1 : blockIds.length
            return blockIds.slice(startBlockIndex, endBlockIndex)
        } catch {
            return []
        }
    }

    #moveBlocksFromNodeToNode(fromNodeId, toNodeId, blockIds) {
        const fromNodeEl = this.#nodes[fromNodeId]
        const toNodeEl = this.#nodes[toNodeId]

        const fromNodeBlockIds = this.#blocksInNodes[fromNodeId]
        const toNodeBlockIds = this.#blocksInNodes[toNodeId]

        const text = blockIds.map(id => this.replicatedBlocks.blocks[id].text).join('')
        toNodeEl.textContent += text

        blockIds.forEach(id => {
            fromNodeBlockIds.splice(fromNodeBlockIds.indexOf(id), 1)
            toNodeBlockIds.push(id)
            this.#nodesWithBlocks[id] = toNodeId
        })

        const fromNodeText = fromNodeBlockIds.map(id => this.replicatedBlocks.blocks[id].text).join('')
        fromNodeEl.textContent = fromNodeText
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

    #getSelectedParagraphId() {
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

        return range.startContainer.parentNode.getAttribute('data-nid')
    }

    #getFirstSelectedBlockId() {
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

        const nodeId = range.startContainer.parentNode.getAttribute('data-nid')
        const contentIndex = range.startOffset

        return this.#getBlockIdFromContent(nodeId, contentIndex)
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
            targetParentId = this.#getFirstSelectedBlockId()
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
            const containerBlockId = this.#nodesWithBlocks[targetCaret.leftId]
            const nodeEl = this.#nodes[containerBlockId]

            if (!nodeEl) {
                console.error('Could not find nodeEl for containerBlockId: ' + containerBlockId)
                return
            }

            const blockId = targetCaret.leftId
            const range = document.createRange()
            const selection = window.getSelection()

            const textEl = nodeEl.childNodes[0]
            let [_, contentIndex] = this.#getBlockIndexAndContentIndex(containerBlockId, blockId)

            const targetForRange = textEl ? textEl : nodeEl

            if (textEl) {
                const maxContentOffset = textEl.textContent.length - 1
                // Clamp contentIndex: [0, maxContentOffset]
                contentIndex = Math.min(Math.max(contentIndex, 0), maxContentOffset)
            } else {
                contentIndex - 1
            }

            try {
                range.setStart(targetForRange, contentIndex + 1)
                range.collapse(true)
                selection.removeAllRanges()
                selection.addRange(range)
            } catch (e) {
                console.error(e)
            }
        }
    }
}