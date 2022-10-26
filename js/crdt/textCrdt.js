import { OpId } from "/js/crdt/opId.js"

export class TextCrdt {
    id = null
    counter = 0
    crdtNodes = {}
    operations = {}
    #opsWithMissingParentId = {}
    #delOpsWithMissingTargetId = {}

    constructor(id) { 
        this.id = id

        this.crdtNodes[OpId.root()] = {
            id: OpId.root(),
            parentId: null,
            childIds: [],
            tagName: 'div',
            text: null,
            deleted: false,
        }
    }

    getOperations() {
        return Object.values(this.operations)
    }

    getNode(id) {
        return this.crdtNodes[id]
    }

    hasOperation(id) {
        return this.operations[id] ? true : false
    }

    executeOperations(ops, callback) {
        if (!ops || ops.length == 0) {
            return
        }

        for (var opi = 0; opi < ops.length; opi++) {
            const op = ops[opi]

            if (this.hasOperation(op.id)) {
                continue
            }

            // Increase the local counter if the op's counter is larger.
            // We do it because we use the counter as a 'Lamport timestamp'
            // to insert nodes in a desirable order.
            // So newer nodes can be inserted in front of old nodes, eg.
            // any time we insert something in between of nodes
            const newOpCounter = op.id.getCounter()
            if (newOpCounter > this.counter) {
                this.counter = newOpCounter
            }

            if (op.type == 'add') {

                // First make sure that needed nodes already exist. If not then 
                // save the operation for later, when a node appears
                if (!this.crdtNodes.hasOwnProperty(op.parentId)) {
                    let arr = []
                    if (this.#opsWithMissingParentId.hasOwnProperty(op.parentId)) {
                        arr = this.#opsWithMissingParentId[op.parentId]
                    }
                    arr.push(op)
                    this.#opsWithMissingParentId[op.parentId] = arr
                    continue
                }

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

                if (OpId.equals(targetLeftId, OpId.root())) {
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

                targetLeftId = this.getNonDeletedLeftId(targetLeftId)

                callback(op, targetLeftId)

                if (this.#opsWithMissingParentId.hasOwnProperty(op.id)) {
                    const ops = this.#opsWithMissingParentId[op.id]
                    if (ops && ops.length > 0) {
                        this.executeOperations(ops, callback)
                    }
                }

                if (this.#delOpsWithMissingTargetId.hasOwnProperty(op.id)) {
                    const ops = this.#delOpsWithMissingTargetId[op.id]
                    if (ops && ops.length > 0) {
                        this.executeOperations(ops, callback)
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

                callback(op)
            }

            this.operations[op.id] = op
        }
    }

    getNewOperationId() {
        this.counter++
        return new OpId(this.counter, this.id)
    }

    #getTailId(id) {
        const node = this.crdtNodes[id]
        if (node.childIds.length == 0) {
            return id
        }

        return this.#getTailId(node.childIds[node.childIds.length - 1])
    }

    #getNonDeletedTailNode(id, startAfterId) {
        const node = this.crdtNodes[id]

        let nonDeletedChildNode = null
        let startLookingInChildren = startAfterId ? false : true

        for (let i = node.childIds.length - 1; i >= 0; i--) {
            const childNode = this.crdtNodes[node.childIds[i]]

            if (startLookingInChildren) {
                // Go down and look for a tail non deleted child node.
                // We do it recursively till we find the tail
                nonDeletedChildNode = this.#getNonDeletedTailNode(node.childIds[i], null)
                if (nonDeletedChildNode != null) {
                    break
                }
            }
            else if (startAfterId && OpId.equals(childNode.id, startAfterId)) {
                startLookingInChildren = true
            }
        }

        if (nonDeletedChildNode == null && !node.deleted) {
            // Return the tail that is not deleted
            return node
        }
        else if (nonDeletedChildNode == null && node.parentId != null) {
            // Go up because we haven't got a non-deleted tail node yet
            return this.#getNonDeletedTailNode(node.parentId, node.id)
        }
        else {
            // Return a non-deleted tail child node. That is the final step.
            // We ether have a node or null here
            return nonDeletedChildNode
        }
    }

    /**
     * Find a target non deleted left id. It goes left until it finds a non-deleted node
     */
    getNonDeletedLeftId(id) {
        if (!id) {
            return null
        }

        const node = this.crdtNodes[id]
        if (!node.deleted) {
            return id
        }

        if (!node.parentId) {
            return null
        }

        const nonDeletedTail = this.#getNonDeletedTailNode(node.parentId, id)
        return nonDeletedTail ? nonDeletedTail.id : null
    }
}