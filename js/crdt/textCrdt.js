import { ActivationOperation, CreationOperation } from "/js/crdt/operations.js"
import { OpId } from "/js/crdt/opId.js"

/**
 * This is our text CRDT based on RGA approach
 */
export class TextCrdt {
    id = null
    counter = 0
    crdtNodes = {}
    operations = {}
    #opsWithMissingParentId = {}
    #delOpsWithMissingTargetId = {}

    /**
     * @param {OpId} id 
     */
    constructor(id) { 
        this.id = id

        this.crdtNodes[OpId.root()] = {
            id: OpId.root(),
            parentId: null,
            childIds: [],
            tagName: 'div',
            text: null,
            isActive: true,
        }
    }

    /**
     * @returns {OpId[]}
     */
    getOperations() {
        return Object.values(this.operations)
    }

    /**
     * @param {*} id 
     * @returns 
     */
    getNode(id) {
        return this.crdtNodes[id]
    }

    /**
     * @param {OpId} id 
     * @returns {Boolean}
     */
    hasOperation(id) {
        return this.operations[id] ? true : false
    }

    /**
     * 
     * @param {OpId[]} ops 
     * @param {*} callback 
     */
    executeOperations(ops, callback) {
        if (!ops || ops.length == 0) {
            return
        }

        for (var opi = 0; opi < ops.length; opi++) {
            const op = ops[opi]

            if (this.hasOperation(op.getId())) {
                continue
            }

            // Increase the local counter if the op's counter is larger.
            // We do it because we use the counter as a 'Lamport timestamp'
            // to insert nodes in a desirable order.
            // So newer nodes can be inserted in front of old nodes, eg.
            // any time we insert something in between of nodes
            const newOpCounter = op.getId().getCounter()
            if (newOpCounter > this.counter) {
                this.counter = newOpCounter
            }

            if (op instanceof CreationOperation) {

                // First make sure that needed nodes already exist. If not then 
                // save the operation for later, when a node appears
                if (!this.crdtNodes.hasOwnProperty(op.getParentId())) {
                    let arr = []
                    if (this.#opsWithMissingParentId.hasOwnProperty(op.getParentId())) {
                        arr = this.#opsWithMissingParentId[op.getParentId()]
                    }
                    arr.push(op)
                    this.#opsWithMissingParentId[op.getParentId()] = arr
                    continue
                }

                let targetLeftId = null
                let indexOfInsertion = 0
                const parentNode = this.crdtNodes[op.getParentId()]
                const childIds = parentNode.childIds

                if (childIds.length > 0) {
                    targetLeftId = op.getParentId()

                    indexOfInsertion = 0
                    // Find an appropriate ID and index to insert after
                    for (let i = 0; i < childIds.length; i++) {
                        const childId = childIds[i]
                        if (op.getId().isGreaterThan(childId)) {
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
                    targetLeftId = op.getParentId()
                }

                if (OpId.equals(targetLeftId, OpId.root())) {
                    targetLeftId = null
                }

                parentNode.childIds.splice(indexOfInsertion, 0, op.getId())

                this.crdtNodes[op.getId()] = {
                    id: op.getId(),
                    parentId: op.getParentId(),
                    childIds: [],
                    tagName: op.getTagName(),
                    text: String(op.getValue()),
                    isActive: true,
                }

                targetLeftId = this.getNonDeletedLeftId(targetLeftId)

                callback(op, targetLeftId)

                if (this.#opsWithMissingParentId.hasOwnProperty(op.getId())) {
                    const ops = this.#opsWithMissingParentId[op.getId()]
                    if (ops && ops.length > 0) {
                        this.executeOperations(ops, callback)
                    }
                }

                if (this.#delOpsWithMissingTargetId.hasOwnProperty(op.getId())) {
                    const ops = this.#delOpsWithMissingTargetId[op.getId()]
                    if (ops && ops.length > 0) {
                        this.executeOperations(ops, callback)
                    }
                }
            } else if (op instanceof ActivationOperation) {
                if (!this.crdtNodes.hasOwnProperty(op.getTargetId())) {
                    let arr = []
                    if (this.#delOpsWithMissingTargetId.hasOwnProperty(op.getTargetId())) {
                        arr = this.#delOpsWithMissingTargetId[op.getTargetId()]
                    }
                    arr.push(op)

                    this.#delOpsWithMissingTargetId[op.getTargetId()] = arr

                    continue
                }

                const node = this.crdtNodes[op.getTargetId()]
                if (!node.activatorId || (op.getId().isGreaterThan(node.activatorId))) {
                    node.isActive = op.isSetToActivate
                    node.activatorId = op.getId()
                    callback(op)
                } 
            }

            this.operations[op.getId()] = op
        }
    }

    /**
     * Get a new Operation ID with the increased local clock
     * @returns {OpId} 
     */
    getNewOperationId() {
        this.counter++
        return new OpId(this.counter, this.id)
    }

    /**
     * Get the tail node ID of a node.
     * Example:
     * - A // node
     *   - B
     *     - C // tail tail 
     * @param {OpId} id 
     * @returns {OpId}
     */
    #getTailId(id) {
        const node = this.crdtNodes[id]
        if (node.childIds.length == 0) {
            return id
        }

        return this.#getTailId(node.childIds[node.childIds.length - 1])
    }

    /**
     * Get the last active tail node
     * @param {OpId} id 
     * @param {OpId} startAfterId 
     * @returns 
     */
    #getNonDeletedTailNode(id, startAfterId) {
        const node = this.crdtNodes[id]

        let nonDeletedChildNode = null
        let startLookingInChildren = startAfterId ? false : true

        for (let i = node.childIds.length - 1; i >= 0; i--) {
            const childNode = this.crdtNodes[node.childIds[i]]

            if (startLookingInChildren) {
                // Go down the tree and look for a tail non deleted child node.
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

        if (nonDeletedChildNode == null && node.isActive) {
            // Return the tail that is not deleted
            return node
        }
        else if (nonDeletedChildNode == null && node.parentId != null) {
            // Go up the tree because we haven't got a non-deleted tail node yet
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
        if (node.isActive) {
            return id
        }

        if (!node.parentId) {
            return null
        }

        const nonDeletedTail = this.#getNonDeletedTailNode(node.parentId, id)
        return nonDeletedTail ? nonDeletedTail.id : null
    }
}