import { ActivationOperation, CreationOperation } from "/js/crdt/operations.js"
import { OpId } from "/js/crdt/opId.js"

/**
 * This class represents an ordered collection of blocks.
 * We use this to modify the state in a way that allows us to merge changes 
 * from multiple users.
 * This can be used for collaborative text editing as well as 
 * any other editing that uses arrays with data.
 * It's based on the CRDT algorithm called RGA (Replicated Growable Array).
 * CRDT (Conflict-free Replicated Data Types) is a way to merge changes consistenly
 * among multiple peers where the peers don't have to manually solve conflicts.
 * 
 * The class maintains a set of blocks (nodes) that have been created, 
 * as well as a set of operations that have been executed. 
 * It provides methods for adding, modifying, and removing blocks, 
 * as well as for querying the state of the array. Operations are responsible
 * for creating and modifying blocks.
 */
// TODO: probably ReplicatedTreeOfBlocks is a better name?
// Simply: it's a tree of blocks that can be replicated among multiple peers
// without conflicts. The brances in that tree are ordered. 
// If we flatten the tree - we will have a consisten order of blocks. 
// Each block may contain a value, such as String. 
// This class can be used to implemented a collaborative text editing
export class ReplicatedTreeOfBlocks {

    id = null
    counter = 0
    // Here are all the blocks that were ever created.
    // The synonym for 'block' is 'node'. But we call it a block because
    // we use the term 'node' for the DOM nodes.
    blocks = {}
    // Here are all the operations that were ever executed.
    // Operations are responsible for creating and modifying blocks.
    operations = {}

    #opsWithMissingParentId = {}
    #delOpsWithMissingTargetId = {}

    /**
     * @param {OpId} id 
     */
    constructor(id) {
        this.id = id

        this.blocks[OpId.root()] = {
            id: OpId.root(),
            parentId: null,
            childIds: [],
            text: null,
            type: 999,
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
     * @param {OpId} id 
     * @returns 
     */
    getBlock(id) {
        return this.blocks[id]
    }

    /**
     * @param {OpId} id 
     * @returns {Boolean}
     */
    hasOperation(id) {
        return this.operations[id] ? true : false
    }

    /**
     * Returns an active block ID to the left of the given block in the parent block.
     * In most cases the active block on the left will be its parent.
     * But it also can be another child of the parent that has a smaller OpId.
     * This is an important function that solves the convergence problem
     * in collaboative editing.
     * @param {*} block 
     * @returns 
     */
    getActiveBlockIdOnTheLeftFrom(block) {
        let targetLeftId = null
        const parentBlock = this.blocks[block.parentId]
        const childIds = parentBlock.childIds

        if (childIds.length > 0) {
            targetLeftId = block.parentId

            let blockOnTheLeftIsChildOfParent = false
            for (let i = 0; i < childIds.length; i++) {
                const childId = childIds[i]
                if (OpId.equals(block.id, childId)) {
                    break
                }

                blockOnTheLeftIsChildOfParent = true
                targetLeftId = childId
            }

            if (blockOnTheLeftIsChildOfParent) {
                // Get the target left at the tail of the targetLeftId because the target
                // may have its own children
                targetLeftId = this.#getTailId(targetLeftId)
            }
        } else {
            targetLeftId = block.parentId
        }

        if (OpId.equals(targetLeftId, OpId.root())) {
            targetLeftId = null
        }

        return this.getActiveId(targetLeftId)
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
            // to insert blocks in a desirable order.
            // So newer blocks can be inserted in front of old blocks, eg.
            // any time we insert something in between of blocks
            const newOpCounter = op.getId().getCounter()
            if (newOpCounter > this.counter) {
                this.counter = newOpCounter
            }

            if (op instanceof CreationOperation) {
                // First make sure that needed blocks already exist. If not then 
                // save the operation for later, when a block appears
                if (!this.blocks.hasOwnProperty(op.getParentId())) {
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
                const parentBlock = this.blocks[op.getParentId()]
                const childIds = parentBlock.childIds

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

                /*
                if (OpId.equals(targetLeftId, OpId.root())) {
                    targetLeftId = null
                }
                */

                parentBlock.childIds.splice(indexOfInsertion, 0, op.getId())

                this.blocks[op.getId()] = {
                    id: op.getId(),
                    parentId: op.getParentId(),
                    childIds: [],
                    text: String(op.getValue()),
                    type: op.getType(),
                    isActive: true,
                }

                targetLeftId = this.getActiveId(targetLeftId)

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
                if (!this.blocks.hasOwnProperty(op.getTargetId())) {
                    let arr = []
                    if (this.#delOpsWithMissingTargetId.hasOwnProperty(op.getTargetId())) {
                        arr = this.#delOpsWithMissingTargetId[op.getTargetId()]
                    }
                    arr.push(op)

                    this.#delOpsWithMissingTargetId[op.getTargetId()] = arr

                    continue
                }

                const block = this.blocks[op.getTargetId()]
                // Actually execute only in case if the block didn't have the activator
                // before or the new activator has a greater ID than the previous one.
                // We ensure the eventual consistency that way with the activation 
                // and deactivation of blocks.
                if (!block.activatorId || (op.getId().isGreaterThan(block.activatorId))) {
                    block.isActive = op.isSetToActivate()
                    block.activatorId = op.getId()

                    const targetLeftId = op.isSetToActivate() ?
                        this.getActiveBlockIdOnTheLeftFrom(this.blocks[op.getTargetId()]) :
                        null

                    callback(op, targetLeftId)
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
     * Find a target active id. It goes left until it finds the first active block
     * @param {OpId} id if the block of this ID is active, 
     * the function returns the same ID, otherwise it goes left
     * @returns {OpId} the first active block ID on the left from the target ID
     */
    getActiveId(id) {
        if (!id) {
            return null
        }

        const block = this.blocks[id]
        if (block.isActive) {
            return id
        }

        if (!block.parentId) {
            return null
        }

        const activeTail = this.#getActiveTailBlock(block.parentId, id)
        return activeTail ? activeTail.id : null
    }

    /**
     * Get the tail block ID of a block.
     * Example:
     * - A // block
     *   - B
     *     - C // tail 
     * @param {OpId} id 
     * @returns {OpId}
     */
    #getTailId(id) {
        const block = this.blocks[id]
        if (block.childIds.length == 0) {
            return id
        }

        return this.#getTailId(block.childIds[block.childIds.length - 1])
    }

    /**
     * Get the nearest active block 
     * @param {OpId} id we start our search from this ID and go down and up the tree from it
     * @param {OpId} startAfterId in case if we need to skip child blocks and start our search after a given child ID
     * @returns {{}}
     */
    #getActiveTailBlock(id, startAfterId) {
        const block = this.blocks[id]

        let activeChildBlock = null
        let startLookingInChildblocks = startAfterId ? false : true

        for (let i = block.childIds.length - 1; i >= 0; i--) {
            const childBlock = this.blocks[block.childIds[i]]

            if (startLookingInChildblocks) {
                // Go down the tree and look for a tail active child block.
                // We do it recursively until we find the tail
                activeChildBlock = this.#getActiveTailBlock(block.childIds[i], null)
                if (activeChildBlock != null) {
                    break
                }
            }
            else if (startAfterId && OpId.equals(childBlock.id, startAfterId)) {
                startLookingInChildblocks = true
            }
        }

        if (activeChildBlock == null && block.isActive) {
            // Return the tail that is active
            return block
        }
        else if (activeChildBlock == null && block.parentId != null) {
            // Go up the tree because we haven't got a an active tail block yet
            return this.#getActiveTailBlock(block.parentId, block.id)
        }
        else {
            // Return an acgtive tail child block. That is the final step.
            // We ether have a block or null here
            return activeChildBlock
        }
    }
}