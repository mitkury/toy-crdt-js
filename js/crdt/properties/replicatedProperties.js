import { SetPropertyOperation } from "/js/crdt/properties/operations.js"
import { OpId } from "/js/crdt/opId.js"

export class ReplicatedProperties {

    id = null
    counter = 0
    // Here are all the blocks that were ever created.
    // The synonym for 'block' is 'node'. But we call it a block because
    // we use the term 'node' for the DOM nodes.
    targets = {}
    // Here are all the operations that were ever executed.
    // Operations are responsible for creating and modifying blocks.
    operations = {}

    /**
     * @param {OpId} id 
     */
    constructor(id) {
        this.id = id
    }

    /**
     * @returns {OpId[]}
     */
    getOperations() {
        return Object.values(this.operations)
    }

    /**
     * @param {OpId} id 
     * @returns {Boolean}
     */
    hasOperation(id) {
        return this.operations[id] ? true : false
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

            this.executeOperation(op, callback)
        }
    }

    executeOperation(op, callback) {
        if (this.hasOperation(op.getId())) {
            return
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

        if (op instanceof SetPropertyOperation) {
            const targetId = op.getTargetId()
            const propName = op.getPropertyName()
            const propValue = op.getPropertyValue()
            const opId = op.getId()

            let target = this.targets[targetId]
            if (!target) {
                target = {}  
            }

            const propPair = target[propName]

            if (!propPair || opId.isGreaterThan(propPair[1])) {
                target[propName] = [propValue, opId]
                this.targets[targetId] = target

                callback && callback(op)
            }

        } else {
            throw new Error("Unknown operation type: " + op)
        }

        this.operations[op.getId()] = op
    }


}