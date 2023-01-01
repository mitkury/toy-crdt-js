export class SetPropertyOperation {
    #opId
    #targetId
    #propName
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
    getTargetId() {
        return this.#targetId
    }

    /**
     * @returns {String}
     */
    getValue() {
        return this.#value
    }

    getPropName() {
        return this.#propName
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
        this.#targetId = targetId
        this.#propName = propName
        this.#value = value
    }
}
