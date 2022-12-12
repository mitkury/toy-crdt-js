/**
 * Responsible for creating text nodes. So when the user types something
 * in a text editor - we use this operation
 */
export class CreationOperation {
    #id
    #parentId
    #type
    #value

    /**
     * @returns {OpId}
     */
    getId() {
        return this.#id
    }

    /**
     * @returns {OpId}
     */
    getParentId() {
        return this.#parentId
    }

    /**
     * @returns {Number} 0 - char, 1 - newline
     */
    getType() {
        return this.#type
    }

    /**
     * @returns {String}
     */
    getValue() {
        return this.#value
    }

    static newChar(id, parentId, value) {
        return new CreationOperation(id, parentId, 0, value)
    }

    static newLine(id, parentId) { 
        return new CreationOperation(id, parentId, 1, null)
    }

    /**
     * @param {OpId} id 
     * @param {OpId} parentId
     * @param {Number} type
     * @param {String} value 
     */
    constructor(id, parentId, type, value) {
        this.#id = id
        this.#parentId = parentId
        this.#type = type
        this.#value = value
    }
}

/**
 * Responsible for deactivating of activating text nodes.
 * So when a user deletes text or undos a deletion - we use this operation
 */
export class ActivationOperation {
    #id
    #targetId
    #isSetToActivate

    /**
    * @returns {OpId}
    */
    getId() {
        return this.#id
    }

    /**
    * @returns {OpId} ID of a node that is going to be deactivated or activated
    */
    getTargetId() {
        return this.#targetId
    }

    /**
    * @returns {Boolean} Whether the operation is activating or deactivating
    */
    isSetToActivate() {
        return this.#isSetToActivate
    }

    /**
     * @param {OpId} id 
     * @param {OpId} targetId 
     * @param {Boolean} isSetToActivate 
     */
    constructor(id, targetId, isSetToActivate) {
        this.#id = id
        this.#targetId = targetId
        this.#isSetToActivate = isSetToActivate
    }
}