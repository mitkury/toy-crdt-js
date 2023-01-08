export class SetPropertyOperation {
    #opId
    #entityId
    #propertyName
    #value

    /**
     * @returns {OpId}
     */
    getId() {
        return this.#opId
    }

    /**
     * @returns {OpId}
     */
    getEntityId() {
        return this.#entityId
    }

    /**
     * @returns {String}
     */
    getValue() {
        return this.#value
    }

    getPropertyName() {
        return this.#propertyName
    }

    static set(opId, targetId, propName, value) {
        return new SetPropertyOperation(opId, targetId, propName, value)
    }

    static delete(opId, targetId) {
        return new SetPropertyOperation(opId, targetId, propName, null)
    }

    /**
     * @param {OpId} opId 
     * @param {OpId} targetId
     * @param {Number} type
     * @param {String} value 
     */
    constructor(opId, targetId, propName, value) {
        this.#opId = opId
        this.#entityId = targetId
        this.#propertyName = propName
        this.#value = value
    }
}
