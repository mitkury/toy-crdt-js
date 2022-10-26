import { element, div, span, nodeHasDataId } from "/js/utils.js"
import { OpId } from "/js/crdt/opId.js"
import { TextCrdt } from "/js/crdt/textCrdt.js"

export class Editor extends EventTarget {

    static #mutationConfig = {
        childList: true,
        subtree: true,
        characterData: true,
        attributeOldValue: true,
        characterDataOldValue: true,
    }

    editorEl = {}
    id = null
    domElements = {}
    caret = null
    observer = null

    #isOnline = false
    #textCrdt = null

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
        this.#textCrdt = new TextCrdt(id)

        div(inElement, containerEl => {
            containerEl.classList.add('editor')

            this.editorEl = div(containerEl, editorEl => {
                editorEl.classList.add('content')
                editorEl.setAttribute('id', id)
                editorEl.setAttribute('data-id', 'root')
                editorEl.setAttribute('contenteditable', 'true')
                editorEl.addEventListener('paste', e => this.#editorPasteHandle(e))
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
                                anchorParentId = elementOnTheLeft.getAttribute('data-id')
                            } else {
                                anchorParentId = OpId.root()
                            }
                        }


                        const newBrId = this.#textCrdt.getNewOperationId()
                        const newSpanId = this.#textCrdt.getNewOperationId()
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
        this.stopObservingMutations()
        this.#executeOperationsUnsafe(ops)
        this.observeMutations()
    }

    getOperations() {
        return this.#textCrdt.getOperations()
    }

    #editorMutationHandle(mutations, observer) {
        const editorEl = this.editorEl

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
                                const newNodeId = this.#textCrdt.getNewOperationId()

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
                                    const newNodeId = this.#textCrdt.getNewOperationId()

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
                                const opIdNewSpan = this.#textCrdt.getNewOperationId()
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
                                id: this.#textCrdt.getNewOperationId(),
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
                                parentId = this.#textCrdt.getNode(initNodeId).parentId
                            }

                            const spanId = this.#textCrdt.getNewOperationId()
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

                    const spanId = this.#textCrdt.getNewOperationId()
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

            const nodeOnTheLeftId = this.#textCrdt.getNonDeletedLeftId(targetCaret.leftId)
            if (nodeOnTheLeftId) {
                const anchorNode = this.domElements[nodeOnTheLeftId]
                selection.setBaseAndExtent(anchorNode, 1, anchorNode, 1)
            }
        }
    }

    #executeOperationsUnsafe(ops) {
        const editorEl = this.editorEl

        if (!ops || ops.length == 0) {
            return
        }

        this.#textCrdt.executeOperations(ops, (op, targetLeftId) => {
            if (op.type == 'add') {

                const newEl = element(op.tagName, editorEl)
                newEl.setAttribute('data-id', op.id)

                if (op.text) {
                    newEl.innerText = op.text
                }

                const actualRoot = this.editorEl
                const leftEl = targetLeftId ? this.domElements[targetLeftId] : null

                if (leftEl && leftEl.nextSibling) {
                    actualRoot.insertBefore(newEl, leftEl.nextSibling)
                } else {
                    actualRoot.prepend(newEl)
                }

                this.domElements[op.id] = newEl

            } else if (op.type == 'del') {
                const element = this.domElements[op.targetId]
                if (element) {
                    element.remove()
                    delete this.domElements[op.targetId]
                }
            }
        })
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
            let elementOnTheLeft = this.domElements[targetParentId].previousSibling
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
            ops.push({
                id: this.#textCrdt.getNewOperationId(),
                targetId: targetId,
                type: 'del'
            })
        }

        const pastedStr = e.clipboardData.getData('text/plain')
        for (let i = 0; i < pastedStr.length; i++) {
            const newOpId = this.#textCrdt.getNewOperationId()
            ops.push({
                id: newOpId,
                parentId: targetParentId,
                type: 'add',
                tagName: 'span',
                text: pastedStr[i]
            })

            targetParentId = newOpId
        }

        this.executeOperations(ops)

        // TODO: refactor a bit
        this.caret = {
            leftId: targetParentId
        }
        const targetCaret = this.caret
        if (targetCaret.leftId) {
            const selection = window.getSelection()

            const nodeOnTheLeftId = this.#textCrdt.getNonDeletedLeftId(targetCaret.leftId)
            if (nodeOnTheLeftId) {
                const anchorNode = this.domElements[nodeOnTheLeftId]
                selection.setBaseAndExtent(anchorNode, 1, anchorNode, 1)
            }
        }
    }
}