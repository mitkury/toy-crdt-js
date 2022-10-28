export class CreationOperation {    
    #id
    #parentId
    #value
    #tagName

    getId() {
        return this.#id
    }

    getParentId() {
        return this.#parentId
    }

    getValue() {
        return this.#value
    }

    getTagName() {
        return this.#tagName
    }

    constructor(id, parentId, value, tagName) {
        this.#id = id
        this.#parentId = parentId
        this.#value = value
        this.#tagName = tagName
    }
}

export class ActivationOperation {    
    #id
    #targetId
    #isSetToActivate

    getId() {
        return this.#id
    }

    getTargetId() {
        return this.#targetId
    }

    isSetToActivate() {
        return this.#isSetToActivate
    }

    constructor(id, targetId, isSetToActivate) {
        this.#id = id
        this.#targetId = targetId
        this.#isSetToActivate = isSetToActivate
    }
}