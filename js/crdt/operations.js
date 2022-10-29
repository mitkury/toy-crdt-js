/**
 * Responsible for creating text nodes
 */
export class CreationOperation {
    #id
    #parentId
    #value
    #tagName

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
     * @returns {String}
     */
    getValue() {
        return this.#value
    }

    /**
     * @returns {String}
     */
    getTagName() {
        return this.#tagName
    }

    /**
     * @param {OpId} id 
     * @param {OpId} parentId 
     * @param {String} value 
     * @param {String} tagName 
     */
    constructor(id, parentId, value, tagName) {
        this.#id = id
        this.#parentId = parentId
        this.#value = value
        this.#tagName = tagName
    }
}

/**
 * Responsible for deactivating of activating text nodes.
 * So when a user deletes text or undos a deletion - we use this operation type
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