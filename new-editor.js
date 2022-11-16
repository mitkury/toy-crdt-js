import { element, div, span, nodeHasDataId } from "/js/utils.js"

console.log("Try the new editing approach")

const editorEl = document.getElementById('editor')

const mutationConfig = {
    childList: true,
    subtree: true,
    characterData: true,
    attributeOldValue: true,
    characterDataOldValue: true,
}

const crdtNodes = []
let counter = 0

function getNewId() {
    let id = counter
    counter++
    return id
}

class EditorSegment {
    constructor(id, segmentElement, textCrdt) {
        this.id = id
        this.segmentEl = segmentElement
        this.textCrdt = textCrdt
        this.nodeIds = []
        this.nodesContentLength = []
    }

    update(oldValue, newValue) {
        // TODO: 
        // find the diff
        // create and execute new operations
        // modify data in the segment about nodes and content
        // apply the new value

        if  (this.nodeIds.length == 0) { 
            const node = {
                id: getNewId(),
                value: newValue
            }

            crdtNodes.push(node)
            this.nodeIds.push(node.id)
        } else {
            const diff = EditorSegment.#diff(oldValue, newValue)
            const diffStartIndex = diff[0]
            const diffNewValue = diff[1]
            const diffOldValue = diff[2]

            let index = diffStartIndex

            // TODO:
            // delete stuff in diffOldValue
            // add stuff from diffNewValue

            let nodeBeforeDiffStarts = null
            let diffIndexCountback = diffStartIndex
            for (let i = 0; i < this.nodeIds.length; i++) {
                const node = crdtNodes[this.nodeIds[i]]
                const valueLength = node.value.length

                if (diffIndexCountback > 0) {
                    nodeBeforeDiffStarts = node
                    diffIndexCountback -= valueLength
                }
            }



        }
    }

    static #diff(oldText, newText) {
        var difStart, difEndOld, difEndNew;
    
        //from left to right - look up the first index where characters are different
        for (let i = 0; i < oldText.length; i++) {
            if (oldText.charAt(i) !== newText.charAt(i)) {
                difStart = i;
                break;
            }
        }
    
        //from right to left - look up the first index where characters are different
        //first calc the last indices for both strings
        var oldMax = oldText.length - 1;
        var newMax = newText.length - 1;
        for (let i = 0; i < oldText.length; i++) {
            if (oldText.charAt(oldMax - i) !== newText.charAt(newMax - i)) {
                //with different string lengths, the index will differ for the old and the new text
                difEndOld = oldMax - i;
                difEndNew = newMax - i;
                break;
            }
        }
    
        var removed = oldText.substr(difStart, difEndOld - difStart + 1);
        var added = newText.substr(difStart, difEndNew - difStart + 1);
    
        return [difStart, added, removed];
    }
}

const editorSegments = {}
let segmentsCounter = 0

const observer = new MutationObserver((mutations, observer) => {

    stopObservingMutations()

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

                        }
                        // Adding an element in any other kind of node
                        else {
                            // We don't add a span that is empty or doesn't have crdtNodes
                            const makesSenseToAdd = node.tagName != 'SPAN' && node && !nodeHasDataId(node.childNodes)

                            if (makesSenseToAdd) {

                            }
                        }

                        node.remove()
                    }
                    // Text
                    else if (node.nodeType === 3) {
                        if (node.parentNode.childNodes.length == 1) {

                        }
                    }
                }
            }

            if (mutation.removedNodes.length > 0) {
                for (var j = 0; j < mutation.removedNodes.length; j++) {
                    const node = mutation.removedNodes[j]

                }
            }

        }
        // A mutation on a CharacterData node (text was edited)
        else if (mutation.type == 'characterData' && mutation.target.parentNode) {
            console.log("Edited characters")

            const parentEl = mutation.target.parentNode
            const segmentId = parentEl.getAttribute('data-sid')

            if (segmentId) {
                const oldValue = mutation.oldValue
                const newValue = mutation.target.data

                const diff = compareText(oldValue, newValue)

                console.log(diff)
            } else {
                const targetData = mutation.target.data
                const targetSegmentId = segmentsCounter
                segmentsCounter++

                span(parentEl, segmentEl => {
                    const editorSegment = new EditorSegment(targetSegmentId, segmentEl, null) 
                    segmentEl.setAttribute('data-sid', targetSegmentId)
                    editorSegment.update('', targetData)
                    editorSegments[editorSegment.id] = editorSegment

                    /*
                    segmentEl.innerText = targetData
                    mutation.target.data = mutation.oldValue*/
                })
            }


        }
    }

    stopObservingMutations()

})

function compareText(oldText, newText) {
    var difStart, difEndOld, difEndNew;

    //from left to right - look up the first index where characters are different
    for (let i = 0; i < oldText.length; i++) {
        if (oldText.charAt(i) !== newText.charAt(i)) {
            difStart = i;
            break;
        }
    }

    //from right to left - look up the first index where characters are different
    //first calc the last indices for both strings
    var oldMax = oldText.length - 1;
    var newMax = newText.length - 1;
    for (let i = 0; i < oldText.length; i++) {
        if (oldText.charAt(oldMax - i) !== newText.charAt(newMax - i)) {
            //with different string lengths, the index will differ for the old and the new text
            difEndOld = oldMax - i;
            difEndNew = newMax - i;
            break;
        }
    }

    var removed = oldText.substr(difStart, difEndOld - difStart + 1);
    var added = newText.substr(difStart, difEndNew - difStart + 1);

    return [difStart, added, removed];
}

function observeMutations() {
    observer.observe(editorEl, mutationConfig)
}

function stopObservingMutations() {
    observer.disconnect()
}

observeMutations()