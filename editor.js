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
    elements = {}
    operations = {}
    caret = null
    observer = null

    constructor(inElement, id) {
        super();

        this.id = id

        this.editorEl = div(inElement, editorEl => {
            editorEl.classList.add('editor')
            editorEl.setAttribute('id', id)
            editorEl.setAttribute('contenteditable', 'true')
            //editorEl.addEventListener('paste', editorPasteHandle)
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
            if (mutation.type == 'childList') {
                if (mutation.addedNodes.length > 0) {
                    for (var j = 0; j < mutation.addedNodes.length; j++) {
                        let node = mutation.addedNodes[j]
                        if (node.nodeType === 1) {
                            const parentId = node.parentNode != editorEl ?
                                node.parentNode.getAttribute('data-id') :
                                'root'

                            ops.push({
                                id: `A@${this.counter}`,
                                parentId: parentId,
                                type: 'add',
                                tagName: node.tagName,

                            })
                            this.counter++

                            node.remove()
                        }
                        else if (node.nodeType === 3) {
                            if (node.parentNode.childNodes.length == 1) {

                                const pId = `${this.id}@${this.counter}`
                                ops.push({
                                    id: pId,
                                    parentId: 'root',
                                    type: 'add',
                                    tagName: 'p',

                                })
                                this.counter++

                                const spanId = `${this.id}@${this.counter}`
                                ops.push({
                                    id: spanId,
                                    parentId: pId,
                                    type: 'add',
                                    tagName: 'span',
                                    text: String(node.textContent)
                                })
                                this.counter++

                                targetCaret.leftId = spanId

                                node.remove()
                            }
                        }
                    }

                }
                else if (mutation.removedNodes.length > 0) {
                    //console.log("Remove nodes")
                } else {
                    //console.log("Something else")
                }
            } else if (mutation.type == 'characterData' && mutation.target.parentNode) {
                const targetText = target.data
                const targetId = target.parentNode.getAttribute('data-id')
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

                        const spanId = `${this.id}@${this.counter}`
                        ops.push({
                            id: spanId,
                            parentId: parentId,
                            leftId: leftId,
                            rightId: rightId,
                            type: 'add',
                            tagName: 'span',
                            text: String(newText)
                        })
                        this.counter++

                        targetCaret.leftId = spanId

                        target.data = prevText
                    }
                } else {
                    // TODO: delete?
                }
            }
        }

        this.#executeOperationsUnsafe(ops)

        this.observeMutations()

        if (targetCaret.leftId) {
            const selection = window.getSelection()
            const anchorNode = this.elements[targetCaret.leftId]
            selection.setBaseAndExtent(anchorNode, 1, anchorNode, 1)
        }

        this.dispatchEvent(new CustomEvent('operationsExecuted', { 
            detail: {
                editorId: this.id,
                operations: ops
            }
        }))
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
                    const parentEl = op.parentId != 'root' ? this.elements[op.parentId] : null
                    const leftEl = op.leftId ? this.elements[op.leftId] : null
                    const rightEl = op.rightId ? this.elements[op.rightId] : null

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

                    this.elements[op.id] = newEl

                } else if (op.type == 'delete') {
                    let el = mthis.elements[op.id]
                    el.remove()
                }

                this.operations[op.id] = op
            } catch (err) {
                console.error(`Couldn't execute operation - ${op.type} ${op.id} because of ${err}`)
            }

        }
    }
}

const mainContainerEl = document.getElementById('editors')

const editors = [
    new Editor(mainContainerEl, 'A'),
    new Editor(mainContainerEl, 'B'),
    new Editor(mainContainerEl, 'C'),
]

editors[0].addEventListener('operationsExecuted', editorOperationsHandle)
editors[1].addEventListener('operationsExecuted', editorOperationsHandle)
editors[2].addEventListener('operationsExecuted', editorOperationsHandle)

function editorOperationsHandle(e) {
    editors.forEach(editor => { 
        if (editor.id != e.detail.editorId) {
            editor.executeOperations(e.detail.operations)
        }
    })
}