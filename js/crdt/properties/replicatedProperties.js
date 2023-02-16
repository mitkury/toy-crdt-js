import { SetPropertyOperation } from "/js/crdt/properties/operations.js"
import { OpId } from "/js/crdt/opId.js"

export class ReplicatedProperties {

    id = null
    counter = 0
    entities = {}
    // Here are all the operations that were ever executed.
    // Operations are responsible for setting properties.
    operations = {}

    pendingOperations = []

    #eventListeners = []

    /**
     * @param {OpId} id 
     */
    constructor(id) {
        this.id = id
    }

    get(entityId, propertyName) {
        if (!this.entities[entityId]) {
            return null
        }

        return this.entities[entityId][0]
    }

    set(entityId, propertyName, value) {
        this.setPending(entityId, propertyName, value)
        this.applyPending()
    }

    setPending(entityId, propertyName, value) { 
        const opId = this.getNewOperationId()
        const op = new SetPropertyOperation(opId, entityId, propertyName, value)
        this.pendingOperations.push(op)
    }

    applyPending() {
        this.executeOperations(this.pendingOperations)
        this.pendingOperations = []
    }

    subscribeToChanges(callback) {
        this.#eventListeners.push(callback)
    }

    merge(other) {
        const otherOps = other.getOperations()
        this.executeOperations(otherOps)
    }

    #dispatchChange(operation) {
        for (var i = 0; i < this.#eventListeners.length; i++) {
            const listener = this.#eventListeners[i]
            listener(operation)
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
     executeOperations(ops) {
        if (!ops || ops.length == 0) {
            return
        }

        for (var opi = 0; opi < ops.length; opi++) {
            const op = ops[opi]

            this.executeOperation(op)
        }
    }

    executeOperation(op) {
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
            const targetId = op.getEntityId()
            const propName = op.getPropertyName()
            const propValue = op.getValue()
            const opId = op.getId()

            let target = this.entities[targetId]
            if (!target) {
                target = {}  
            }

            const propPair = target[propName]

            if (!propPair || opId.isGreaterThan(propPair[1])) {
                target[propName] = [propValue, opId]
                this.entities[targetId] = target

                this.#dispatchChange(op)
            }

        } else {
            throw new Error("Unknown operation type: " + op)
        }

        this.operations[op.getId()] = op
    }

    clear() {
        this.entities = {}
        this.operations = {}
        this.pendingOperations = []
    }


}