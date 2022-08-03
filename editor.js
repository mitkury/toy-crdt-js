console.log('Start Toy Editor')

const mainContainerEl = document.getElementById('editors')

const editors = [
    editor(mainContainerEl, 'A'),
    editor(mainContainerEl, 'B'),
    editor(mainContainerEl, 'C'),
]

function editor(inElement, id) {
    const editorEl = div(inElement, editorEl => {
        editorEl.classList.add('editor')
        editorEl.setAttribute('id', id)
        editorEl.setAttribute('contenteditable', 'true')
        editorEl.addEventListener('paste', editorPasteHandle)
    })
    editorEl.editorModel = {
        id: id,
        counter: 0,
        elements: {},
        operations: {},
        caret: null,
        observer: null
    }

    editorEl.editorModel.observer = new MutationObserver((mutations, observer) =>
        editorMutateHandle(editorEl, mutations, observer)
    )

    document.addEventListener('selectionchange', e => {
        if (!document.activeElement) {
            editorEl.editorModel.caret = null
            return
        }

        if (document.activeElement.getAttribute('id') != id) {
            return
        }

        const selection = window.getSelection()

        editorEl.editorModel.caret = {
            leftId: selection.anchorNode    
        }

        console.log(editorEl.editorModel.caret)
    })

    const mutationConfig = {
        //attributes: true,
        childList: true,
        subtree: true,
        characterData: true,
        attributeOldValue: true,
        characterDataOldValue: true,
    }

    editorEl.observeMutations = function () {
        this.editorModel.observer.observe(this, mutationConfig)
    }

    editorEl.stopObservingMutations = function () {
        this.editorModel.observer.disconnect()
    }

    editorEl.observeMutations()

    return editorEl
}

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


function syncEditors(editors) {
    editors.forEach(e => {

    })
}

function editorPasteHandle(e) {
    e.preventDefault()

    console.log("TODO: implement paste")

    // TODO: implement paste and filtering of pasted content
}

function editorMutateHandle(editorEl, mutations, observer) {
    editorEl.stopObservingMutations()

    const model = editorEl.editorModel
    const ops = []

    const targetCaret = editorEl.editorModel.caret ? editorEl.editorModel.caret : {}

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
                            id: `A@${model.counter}`,
                            parentId: parentId,
                            type: 'add',
                            tagName: node.tagName,

                        })
                        model.counter++

                        node.remove()
                    }
                    else if (node.nodeType === 3) {
                        if (node.parentNode.childNodes.length == 1) {

                            const pId = `${model.id}@${model.counter}`
                            ops.push({
                                id: pId,
                                parentId: 'root',
                                type: 'add',
                                tagName: 'p',

                            })
                            model.counter++

                            const spanId = `${model.id}@${model.counter}`
                            ops.push({
                                id: spanId,
                                parentId: pId,
                                type: 'add',
                                tagName: 'span',
                                text: String(node.textContent)
                            })
                            model.counter++

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

            const targetOp = model.operations[targetId]

            const leftId = insertOnTheRight ? targetId : targetOp.leftId
            const rightId = insertOnTheRight ? targetOp.rightId : targetId

            if (targetText) {
                if (targetText.length > prevText.length) {
                    const newText = targetText.replace(prevText, '')

                    const spanId = `${model.id}@${model.counter}`
                    ops.push({
                        id: spanId,
                        parentId: parentId,
                        leftId: leftId,
                        rightId: rightId,
                        type: 'add',
                        tagName: 'span',
                        text: String(newText)
                    })
                    model.counter++

                    targetCaret.leftId = spanId 

                    target.data = prevText
                }
            } else {
                // TODO: delete?
            }
        }
    }

    executeOperations(editorEl, ops)

    editorEl.observeMutations()

    if (targetCaret.leftId) {
        const selection = window.getSelection()
        const anchorNode = editorEl.editorModel.elements[targetCaret.leftId]
        selection.setBaseAndExtent(anchorNode, 1,anchorNode, 1)
    }
}

function executeOperations(editorEl, ops) {
    if (!ops || ops.length == 0) {
        return
    }

    const model = editorEl.editorModel

    for (var i = 0; i < ops.length; i++) {
        const op = ops[i]
        try {
            if (op.type == 'add') {
                const parentEl = op.parentId != 'root' ? model.elements[op.parentId] : null
                const leftEl = op.leftId ? model.elements[op.leftId] : null
                const rightEl = op.rightId ? model.elements[op.rightId] : null

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

                model.elements[op.id] = newEl

            } else if (op.type == 'delete') {
                let el = model.elements[op.id]
                el.remove()
            }

            model.operations[op.id] = op
        } catch (err) {
            console.error(`Couldn't execute operation - ${op.type} ${op.id} because of ${err}`)
        }

    }
}