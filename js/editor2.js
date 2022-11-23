import { element, div, span, nodeHasDataId } from "/js/utils.js"
import { OpId } from "/js/crdt/opId.js"
import { TextCrdt } from "/js/crdt/textCrdt.js"
import { ActivationOperation, CreationOperation } from "/js/crdt/operations.js"
import { diff, NOOP, REPLACE, DELETE, INSERT } from "/js/myersDiff.js"

const d = diffProcess("hello world", "hey beautiful world")

function diffProcess(source, target) {
    const changes = diff(source, target);
    let sourceIndex = 0;
    let targetIndex = 0;

    // TODO: 
    // ingegrate into segment
    // gather IDs from indices
    // create new nodes and insert them before target nodes (found from indices)

    // fun: how about optimizing this diff with my previous solution of finding
    // only insertions and deletions at the start and end?

    for (let i = 0, { length } = changes; i < length; i++) {
        switch (changes[i]) {

            // in both REPLACE and NOOP cases
            // move forward with both indexes
            case REPLACE:
                console.log("Replace \'"+source[sourceIndex]+"\' with \'"+target[targetIndex]+"\'")
                // in replace case, you can safely pass the value
                //source[sourceIndex] = target[targetIndex];
            // se no break here: the fallthrough in meant to increment
            case NOOP:
                sourceIndex++;
                targetIndex++;
                break;

            case DELETE:
                console.log("Delete \'"+source[sourceIndex]+"\'")
                //source.splice(sourceIndex, 1);
                // Note: in this case don't increment the sourceIndex
                // as the length mutated via splice, however,
                // you should increment sourceIndex++ if you are dealing
                // with a parentNode, as example, and the source is a facade
                // never touch the targetIndex during DELETE
                break;

            case INSERT:
                console.log("Insert \'"+target[targetIndex]+"\'")
                // Note: in this case, as the length is mutated again
                // you need to move forward sourceIndex++ too
                // but if you appending nodes, or inserting before other nodes,
                // you should *not* move sourceIndex forward
                //source.splice(sourceIndex++, 0, target[targetIndex]);

                // the targetIndex instead should *always* be incremented on INSERT
                targetIndex++;
                break;
        }
    }
}

export class Editor extends EventTarget {

    #editorEl = {}
    #id = null
    #domElements = {}
    #caret = null
    #observer = null
    #isOnline = false
    textCrdt = null
    #opsDidByClient = []
    #opsUndidByClient = []
    #ctrlIsPressed = false
    #editorSegments = {}
    #segmentCounter = 0

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
        this.textCrdt = new TextCrdt(id)

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

                        // y
                        if (e.keyCode == 89) {
                            e.preventDefault()
                            this.redo()
                        }
                    }

                    if (e.key === 'Enter') {
                        e.preventDefault()

                        return

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

                        const newBrId = this.textCrdt.getNewOperationId()
                        const newSpanId = this.textCrdt.getNewOperationId()
                        const ops = []
                        ops.push(new CreationOperation(
                            newBrId,
                            anchorParentId,
                            null,
                            'br'
                        ))
                        ops.push(new CreationOperation(
                            newSpanId,
                            newBrId,
                            // Insert 'zero width space' in the span. Otherwise the caret 
                            // doesn't want to go into an element without a text node
                            '\u200B',
                            'span'
                        ))

                        this.executeOperations(ops)
                        this.#addOpIdsToArrayOfOpsDidByClient(ops)

                        this.dispatchEvent(new CustomEvent('operationsExecuted', {
                            detail: {
                                editorId: this.#id,
                                operations: ops
                            }
                        }))

                        // Put the caret inside the span element
                        const newAnchorNode = this.#domElements[newSpanId]
                        selection.setBaseAndExtent(newAnchorNode, 1, newAnchorNode, 1)
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

            // TODO: find the segment correctly
            const segment = this.#editorSegments[0]

            if (segment) {
                const nodeId = segment.getNodeId(selection.anchorOffset)

                this.#caret = {
                    leftId: nodeId
                }
            }
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
        return this.textCrdt.getOperations()
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
                        const targetId = OpId.tryParseStr(node.getAttribute('data-id'))
                        if (targetId) {
                            ops.push(new ActivationOperation(
                                this.#textCrdt.getNewOperationId(),
                                targetId,
                                false
                            ))
                        } else {

                        }
                        */
                    }
                }

            }
            // A mutation on a CharacterData node (text was edited)
            else if (mutation.type == 'characterData' && mutation.target.parentNode) {
                const parentEl = mutation.target.parentNode
                const segmentId = parentEl.getAttribute('data-sid')

                if (segmentId) {
                    const oldValue = mutation.oldValue
                    const newValue = mutation.target.data
                    const editorSegment = this.#editorSegments[segmentId]
                    editorSegment.segmentEl.innerText = oldValue

                    const diff2 = diff(oldValue, newValue)

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
                                    leftId: this.textCrdt.crdtNodes[nodeId].parentId
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
                } else {
                    const targetData = mutation.target.data

                    // TODO: get previous segment is it exists
                    const leftSegment = this.#editorSegments[0]
                    let nodeLeftId = null
                    // Here we get targetLeftId from the last node of the previous segment
                    if (leftSegment) {
                        nodeLeftId = OpId.root()
                    } else {
                        nodeLeftId = OpId.root()
                    }

                    const op = new CreationOperation(
                        this.textCrdt.getNewOperationId(),
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

    #getReverseOp(op) {
        let reverseOp = null

        if (op instanceof CreationOperation) {
            reverseOp = new ActivationOperation(
                this.textCrdt.getNewOperationId(),
                op.getId(),
                false
            )
        } else if (op instanceof ActivationOperation) {
            if (op.isSetToActivate()) {
                reverseOp = new ActivationOperation(
                    this.textCrdt.getNewOperationId(),
                    op.getTargetId(),
                    false
                )
            } else {
                reverseOp = new ActivationOperation(
                    this.textCrdt.getNewOperationId(),
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

        const opToUndo = this.textCrdt.operations[this.#opsDidByClient.pop()]
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

        const opToRedo = this.textCrdt.operations[this.#opsUndidByClient.pop()]
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

    #insertNode(id, value, tagName, targetLeftId) {
        const newEl = element(tagName, this.#editorEl)
        newEl.setAttribute('data-id', id)
        newEl.innerText = value

        const leftEl = targetLeftId ? this.#domElements[targetLeftId] : null

        if (leftEl && leftEl.nextSibling) {
            this.#editorEl.insertBefore(newEl, leftEl.nextSibling)
        } else {
            this.#editorEl.prepend(newEl)
        }

        this.#domElements[id] = newEl
    }

    #executeOperationsUnsafe(ops) {
        const editorEl = this.#editorEl

        if (!ops || ops.length == 0) {
            return
        }

        this.textCrdt.executeOperations(ops, (op, targetLeftId) => {
            let segment = this.#editorSegments[0]
            if (!segment) {
                const targetSegmentId = this.#segmentCounter
                this.#segmentCounter++
                const segmentEl = span(this.#editorEl)
                segment = new EditorSegment(segmentEl, this)
                segmentEl.setAttribute('data-sid', targetSegmentId)
                /*
                targetCaret.leftId = editorSegment.nodeIds[0]
                targetCaret.segmentId = targetSegmentId
                targetCaret.posInSegment = 1
                */
                this.#editorSegments[targetSegmentId] = segment
            }

            if (op instanceof CreationOperation) {
                segment.addNode(op.getId(), targetLeftId)
            } else if (op instanceof ActivationOperation) {
                if (!op.isSetToActivate()) {
                    segment.removeNode(op.getTargetId())
                } else {
                    segment.addNode(op.getTargetId(), targetLeftId)
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

    #getSelectedNodes() {
        const selection = window.getSelection()
        // TODO: support multiple ranges
        return selection.getRangeAt(0).cloneContents().querySelectorAll("[data-id]")
    }

    #editorPasteHandle(e) {
        e.preventDefault()

        let targetParentId = this.#getTargetParentIdFromSelection()

        if (targetParentId == null) {
            return
        }

        const ops = []

        // First detect and delete selected nodes
        const selectedNodes = this.#getSelectedNodes()
        for (let i = 0; i < selectedNodes.length; i++) {
            const targetId = selectedNodes[i].getAttribute('data-id')
            ops.push(new ActivationOperation(
                this.textCrdt.getNewOperationId(),
                targetId,
                false
            ))
        }

        const pastedStr = e.clipboardData.getData('text/plain')
        for (let i = 0; i < pastedStr.length; i++) {
            const newOpId = this.textCrdt.getNewOperationId()
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

            const nodeOnTheLeftId = this.textCrdt.getActiveId(targetCaret.leftId)
            if (nodeOnTheLeftId) {
                const anchorNode = this.#domElements[nodeOnTheLeftId]
                selection.setBaseAndExtent(anchorNode, 1, anchorNode, 1)
            }
        }
    }

    #updateCaretPos() {
        const targetCaret = this.#caret
        if (targetCaret != null && targetCaret.leftId) {
            const segment = this.#editorSegments[0]
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

class EditorSegment {

    constructor(segmentElement, editor) {
        this.segmentEl = segmentElement
        this.editor = editor
        this.nodeIds = []
    }

    getDiff(oldValue, newValue, callback) {
        const diff = EditorSegment.#diff(oldValue, newValue)
        const diffStartIdx = diff[0]
        const addedText = diff[1]
        const replaceRange = diff[2]

        const crdtNodes = this.editor.textCrdt.crdtNodes

        let targetLeftId = null
        let startNodeIndex = -1

        const nodeIdsToDelete = []

        let diffIndexCountback = diffStartIdx

        // Get the node we're going to insert after
        for (let i = 0; i < this.nodeIds.length; i++) {
            const node = crdtNodes[this.nodeIds[i]]
            const valueLength = node.text.length

            if (diffIndexCountback <= 0) {
                break
            }

            if (diffIndexCountback > 0) {
                targetLeftId = node.id
                startNodeIndex = i + 1
                diffIndexCountback -= valueLength
            }
        }

        if (!targetLeftId) {
            const firstNode = crdtNodes[this.nodeIds[0]]
            targetLeftId = firstNode.parentId
            startNodeIndex = 0
        }

        let replacementDiff = replaceRange
        for (let i = startNodeIndex; i < this.nodeIds.length; i++) {
            const node = crdtNodes[this.nodeIds[i]]
            const valueLength = node.text.length

            if (replacementDiff <= 0) {
                break
            }

            replacementDiff -= valueLength
            nodeIdsToDelete.push(node.id)
        }

        if (callback)
            callback(addedText, startNodeIndex, targetLeftId, nodeIdsToDelete)
    }

    addNode(nodeId, targetLeftId) {
        const node = this.editor.textCrdt.crdtNodes[nodeId]

        let [nodeIndex, contentIndex] = this.getNodeIndexAndContentIndex(targetLeftId)
        nodeIndex++
        contentIndex++

        this.nodeIds.splice(nodeIndex, 0, nodeId)

        const str = this.segmentEl.innerText
        this.segmentEl.innerText =
            str.slice(0, contentIndex) +
            node.text +
            str.slice(contentIndex);
    }

    removeNode(nodeId) {
        const [nodeIndex, sliceStart] = this.getNodeIndexAndContentIndex(nodeId)
        const node = this.editor.textCrdt.crdtNodes[nodeId]
        const sliceEnd = sliceStart + node.text.length

        this.nodeIds.splice(nodeIndex, 1)

        const segmentText = this.segmentEl.innerText
        const newSegmentText = segmentText.substring(0, sliceStart) + segmentText.substring(sliceEnd)
        this.segmentEl.innerText = newSegmentText
    }

    getNodeIndexAndContentIndex(nodeId) {
        let contentIndex = 0
        for (var i = 0; i < this.nodeIds.length; i++) {
            const node = this.editor.textCrdt.crdtNodes[this.nodeIds[i]]

            if (OpId.equals(node.id, nodeId)) {
                return [i, contentIndex]
            }

            contentIndex += node.text.length
        }

        return [-1, -1]
    }

    getNodeId(contentIndex) {
        let contIdx = 0
        for (var i = 0; i < this.nodeIds.length; i++) {
            const node = this.editor.textCrdt.crdtNodes[this.nodeIds[i]]

            contIdx += node.text.length

            if (contIdx >= contentIndex) {
                return node.id
            }
        }

        return null
    }

    static #diff(oldStr, newStr) {
        if (oldStr === newStr) {
            return [0, '', 0]
        }

        const oldLength = oldStr.length
        const newLength = newStr.length
        const largestLength = newStr.length > oldStr.length ? newStr.length : oldStr.length
        const newIsLongerThanOld = newLength > oldLength

        let start = -1
        for (let i = 0; i < largestLength; i++) {
            if (oldStr.charAt(i) !== newStr.charAt(i)) {
                start = i;
                break;
            }
        }

        // Added at the end
        if (newIsLongerThanOld && start >= oldLength) {
            console.log("Added at the end")
            return [oldLength, newStr.substr(start, newLength - oldLength), 0]
        }

        // Removed at the end
        if (!newIsLongerThanOld && start >= newLength) {
            console.log("Removed at the end")
            return [newLength, '', oldLength - newLength]
        }

        let end = -1
        let oldIdx = oldLength - 1
        let newIdx = newLength - 1
        let i = largestLength - 1
        while (i > 0) {
            if (oldStr.charAt(oldIdx) !== newStr.charAt(newIdx)) {
                end = i
                break
            }

            oldIdx--
            newIdx--
            i--
        }

        // Added at the start
        if (newIsLongerThanOld && end <= newLength - oldLength - 1) {
            console.log("Added at the start")
            return [0, newStr.substr(0, newLength - oldLength), 0]
        }

        // Removed at the start
        if (!newIsLongerThanOld && end <= oldLength - newLength - 1) {
            console.log("Removed at the start")
            return [0, '', oldLength - newLength]
        }

        // Removed, replaced or inserted

        const newStrRange = newIdx - start
        const addedStr = newStr.substr(start, end)
        const replacementRange = end - start + 1

        return [start, addedStr, replacementRange]


        /*
        if (oldStr === newStr) {
            return [0, '', 0]
        }

        let start = -1
        const largestLength = newStr.length > oldStr.length ? newStr.length : oldStr.length

        // Scan from left to right to find an index where the diff starts
        // The start is the index where the change starts
        for (let i = 0; i < largestLength; i++) {
            if (oldStr.charAt(i) !== newStr.charAt(i)) {
                start = i;
                break;
            }
        }

        // Scan from right to left to find ends in new and old strings
        // The end is the index where the change didn't start yet and the char
        // on the left to that index (index - 1) is changed.
        let newEnd = newStr.length
        let end = oldStr.length
        for (let i = oldStr.length - 1; i >= 0; i--) {
            if (oldStr.charAt(i) !== newStr.charAt(newEnd - 1)) {
                break;
            }

            end--
            newEnd--
        }

        const newStrRange = newEnd - start
        const addedStr = newStr.substr(start, newStrRange)
        const replacementRange = end - start

        return [start, addedStr, replacementRange]
        */
    }
}