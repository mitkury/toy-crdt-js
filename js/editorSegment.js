import { element, div, span, nodeHasDataId } from "/js/utils.js"
import { OpId } from "/js/crdt/opId.js"
import { TextCrdt } from "/js/crdt/textCrdt.js"
import { ActivationOperation, CreationOperation } from "/js/crdt/operations.js"
import { diff, NOOP, REPLACE, DELETE, INSERT } from "/js/myersDiff.js"

export class EditorSegment {

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

    processMutation(oldValue, newValue) {
        const changes = diff(oldValue, newValue);
        let sourceIndex = 0;
        let targetIndex = 0;
        let lastInsertionIdx = -2

        // Gather batches of insertions and deletions
        let insertions = []
        let deletions = []

        for (let i = 0, { length } = changes; i < length; i++) {
            switch (changes[i]) {
                case REPLACE:
                    // TODO: fix replacement

                    const nodeId = this.getNodeId(sourceIndex + 1)
                    deletions.push(nodeId)
                    insertions.push({
                        leftId: nodeId,
                        value: newValue[targetIndex]
                    })
                   
                    sourceIndex++;
                    targetIndex++;
                    break;
                    
                case NOOP:
                    sourceIndex++;
                    targetIndex++;
                    break;
    
                case DELETE:
                    deletions.push(this.getNodeId(sourceIndex + 1))
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
                            leftId: this.getNodeId(sourceInsertionIndex + 1),
                            value: ""
                        }
                        insertions.push(insertion)
                    }

                    insertion.value += newValue[targetIndex]
                    lastInsertionIdx = i

                    targetIndex++;
                    break;
            }
        }

        return {
            insertions: insertions,
            deletions: deletions
        }
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
        if (this.nodeIds.length == 0) {
            return null
        }

        const crdtNodes = this.editor.textCrdt.crdtNodes

        if (contentIndex <= 0) {
            const firstNode = crdtNodes[this.nodeIds[0]]
            return firstNode.parentId
        }

        let contIdx = 0
        for (var i = 0; i < this.nodeIds.length; i++) {
            const node = crdtNodes[this.nodeIds[i]]

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