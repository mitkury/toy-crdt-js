import { element, div, span, nodeHasDataId } from "/js/utils.js"
import { OpId } from "/js/crdt/opId.js"
import { TextCrdt } from "/js/crdt/textCrdt.js"
import { ActivationOperation, CreationOperation } from "/js/crdt/operations.js"

export class Editor extends EventTarget {

    #editorEl = {}
    #id = null
    #domElements = {}
    #caret = null
    #observer = null
    #isOnline = false
    #textCrdt = null
    #opsDidByClient = []
    #undoIndex = 0

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
        this.#textCrdt = new TextCrdt(id)

        div(inElement, containerEl => {
            containerEl.classList.add('editor')

            this.#editorEl = div(containerEl, editorEl => {
                editorEl.classList.add('content')
                editorEl.setAttribute('id', id)
                editorEl.setAttribute('data-id', 'root')
                editorEl.setAttribute('contenteditable', 'true')
                editorEl.addEventListener('paste', e => this.#editorPasteHandle(e))
                editorEl.addEventListener('beforeinput', e => {
                    switch (e.inputType) {
                        case "historyUndo": this.#handleUndo(e); break
                        case "historyRedo": this.#handleRedo(e); break
                    }
                })
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
                            let elementOnTheLeft = this.#domElements[anchorParentId].previousSibling
                            if (elementOnTheLeft != null) {
                                anchorParentId = elementOnTheLeft.getAttribute('data-id')
                            } else {
                                anchorParentId = OpId.root()
                            }
                        }

                        const newBrId = this.#textCrdt.getNewOperationId()
                        const newSpanId = this.#textCrdt.getNewOperationId()
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

        this.#observeMutations()
    }

    /**
    * @param {OpId[]} ops
    */
    executeOperations(ops) {
        this.#stopObservingMutations()
        this.#executeOperationsUnsafe(ops)
        this.#observeMutations()
    }

    /**
    * @returns {OpId[]}
    */
    getOperations() {
        return this.#textCrdt.getOperations()
    }

    static #mutationConfig = {
        childList: true,
        subtree: true,
        characterData: true,
        attributeOldValue: true,
        characterDataOldValue: true,
    }

    #observeMutations() {
        this.#observer.observe(this.#editorEl, Editor.#mutationConfig)
    }

    #stopObservingMutations() {
        this.#observer.disconnect()
    }

    #editorMutationHandle(mutations, observer) {
        const editorEl = this.#editorEl

        this.#stopObservingMutations()

        const ops = []

        const targetCaret = this.#caret ? this.#caret : {}

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
                                const newNodeId = this.#textCrdt.getNewOperationId()

                                ops.push(new CreationOperation(
                                    newNodeId,
                                    leftId,
                                    null,
                                    node.tagName
                                ))

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
                                    const newNodeId = this.#textCrdt.getNewOperationId()

                                    ops.push(new CreationOperation(
                                        newNodeId,
                                        parentId,
                                        null,
                                        node.tagName
                                    ))

                                    targetCaret.leftId = newNodeId
                                }
                            }

                            node.remove()
                        }
                        // Text
                        else if (node.nodeType === 3) {
                            if (node.parentNode.childNodes.length == 1) {
                                const opIdNewSpan = this.#textCrdt.getNewOperationId()
                                ops.push(new CreationOperation(
                                    opIdNewSpan,
                                    'root',
                                    String(node.textContent),
                                    'span'
                                ))

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
                            ops.push(new ActivationOperation(
                                this.#textCrdt.getNewOperationId(),
                                targetId,
                                false
                            ))
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
                                parentId = this.#textCrdt.getNode(initNodeId).parentId
                            }

                            const spanId = this.#textCrdt.getNewOperationId()
                            ops.push(new CreationOperation(
                                spanId,
                                parentId,
                                String(newText),
                                'span'
                            ))

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

                    const spanId = this.#textCrdt.getNewOperationId()
                    ops.push(new CreationOperation(
                        spanId,
                        'root',
                        String(targetText),
                        'span'
                    ))

                    targetCaret.leftId = spanId

                    target.remove()
                }
            }
        }

        this.#executeOperationsUnsafe(ops)
        this.#addOpIdsToArrayOfOpsDidByClient(ops)

        this.#observeMutations()

        this.dispatchEvent(new CustomEvent('operationsExecuted', {
            detail: {
                editorId: this.#id,
                operations: ops
            }
        }))

        if (targetCaret.leftId) {
            const selection = window.getSelection()

            const nodeOnTheLeftId = this.#textCrdt.getNonDeletedLeftId(targetCaret.leftId)
            if (nodeOnTheLeftId) {
                const anchorNode = this.#domElements[nodeOnTheLeftId]
                selection.setBaseAndExtent(anchorNode, 1, anchorNode, 1)
            }
        }
    }

    #handleUndo(e) {
        e.preventDefault()

        if (this.#opsDidByClient.length == 0) {
            return
        }

        const opToUndo = this.#textCrdt.operations[this.#opsDidByClient[this.#undoIndex]]
        this.#undoIndex--

        let reverseOp = null

        if (opToUndo instanceof CreationOperation) {
            reverseOp = new ActivationOperation(
                this.#textCrdt.getNewOperationId(),
                opToUndo.id,
                false
            )
        } else if (opToUndo instanceof ActivationOperation) {
            // TODO: implement
            if (opToUndo.isSetToActivate()) {

            } else {

            }

            /*
            const creationOp = this.#textCrdt.operations[opToUndo.targetId]
            reverseOp = {
                ...creationOp
            }
            
            reverseop.getId() = this.#textCrdt.getNewOperationId()
            */
        }

        this.executeOperations([reverseOp])
        this.#addOpIdsToArrayOfOpsDidByClient([reverseOp], true)
    }

    #handleRedo(e) {
        e.preventDefault()
    }

    #executeOperationsUnsafe(ops) {
        const editorEl = this.#editorEl

        if (!ops || ops.length == 0) {
            return
        }

        this.#textCrdt.executeOperations(ops, (op, targetLeftId) => {
            if (op instanceof CreationOperation) {

                const newEl = element(op.getTagName(), editorEl)
                newEl.setAttribute('data-id', op.getId())

                if (op.getValue()) {
                    newEl.innerText = op.getValue()
                }

                const actualRoot = this.#editorEl
                const leftEl = targetLeftId ? this.#domElements[targetLeftId] : null

                if (leftEl && leftEl.nextSibling) {
                    actualRoot.insertBefore(newEl, leftEl.nextSibling)
                } else {
                    actualRoot.prepend(newEl)
                }

                this.#domElements[op.getId()] = newEl

            } else if (op instanceof ActivationOperation) {

                if (!op.isSetToActivate()) {
                    const element = this.#domElements[op.getTargetId()]
                    if (element) {
                        element.remove()
                        delete this.#domElements[op.getTargetId()]
                    }
                } else {
                    // TODO: implement activation / re-creation
                }

            }
        })
    }

    #addOpIdsToArrayOfOpsDidByClient(ops, dontResetIndex) {
        // TODO: consider scoping those ops so it's possible to undo them in one go
        const opIds = ops.map(o => o.id)
        this.#opsDidByClient.push(...opIds)

        if (!dontResetIndex) {
            // Reset the index
            this.#undoIndex = this.#opsDidByClient.length - 1
        }
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
            // Try to get the non-deleted node on the left
            // If the element exists in the editor we assume
            // it's not deleted
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
                this.#textCrdt.getNewOperationId(),
                targetId,
                false
            ))
        }

        const pastedStr = e.clipboardData.getData('text/plain')
        for (let i = 0; i < pastedStr.length; i++) {
            const newOpId = this.#textCrdt.getNewOperationId()
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
        this.caret = {
            leftId: targetParentId
        }
        const targetCaret = this.#caret
        if (targetCaret.leftId) {
            const selection = window.getSelection()

            const nodeOnTheLeftId = this.#textCrdt.getNonDeletedLeftId(targetCaret.leftId)
            if (nodeOnTheLeftId) {
                const anchorNode = this.#domElements[nodeOnTheLeftId]
                selection.setBaseAndExtent(anchorNode, 1, anchorNode, 1)
            }
        }
    }
}