export class OpId {
    #peerId
    #counter

    static compare(opIdA, opIdB) {
        if (opIdA instanceof OpId === false) {
            opIdA = OpId.tryParseStr(opIdA)
        }
        if (opIdB instanceof OpId === false) {
            opIdB = OpId.tryParseStr(opIdB)
        }

        const counterA = opIdA.getCounter()
        const counterB = opIdB.getCounter()

        if (counterA > counterB) {
            return 1
        }
        else if (counterA < counterB) {
            return -1
        }
        else {
            const comparePeerId = opIdA.getPeerId().localeCompare(opIdB.getPeerId())
            return comparePeerId
        }
    }

    static equals(opIdA, opIdB) {
        if (opIdA == null && opIdB == null) {
            return true
        }
        else if (!opIdA || !opIdB) {
            return false
        }

        return OpId.compare(opIdA, opIdB) == 0
    }

    static tryParseStr(opIdStr) {
        if (!opIdStr) {
            return null
        }

        if (opIdStr == 'root') {
            return this.root()
        }

        const parts = opIdStr.split('@')

        if (parts.length != 2) {
            return null
        }

        return new OpId(parts[0], parts[1])
    }

    static root() {
        return new OpId(0, '')
    }

    constructor(counter, peerId) {
        this.#counter = counter
        this.#peerId = peerId
    }

    isRoot() {
        return this.#peerId === '' && this.#counter === 0
    }

    getPeerId() {
        return this.#peerId
    }

    getCounter() {
        return this.#counter
    }

    isGreaterThan(opId) {
        return OpId.compare(this, opId) == 1
    }

    toString() {
        if (this.isRoot()) {
            return 'root'
        }

        return this.#counter + '@' + this.#peerId
    }
}
