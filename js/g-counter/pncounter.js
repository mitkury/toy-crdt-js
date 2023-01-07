export class PNCounter {
    constructor() {
        this.increments = new Map()
        this.decrements = new Map()
    }

    increment(replicaId) {
        let count = this.increments.get(replicaId) || 0
        count++
        this.increments.set(replicaId, count)
    }

    decrement(replicaId) {
        let count = this.decrements.get(replicaId) || 0
        count++
        this.decrements.set(replicaId, count)
    }

    value() {
        let sum = 0
        for (let count of this.increments.values()) {
            sum += count
        }

        for (let count of this.decrements.values()) {
            sum -= count
        }

        return sum
    }

    merge(other) {
        for (let [replicaId, count] of other.increments.entries()) {
            let myCount = this.increments.get(replicaId) || 0
            this.increments.set(replicaId, Math.max(myCount, count))
        }

        for (let [replicaId, count] of other.decrements.entries()) {
            let myCount = this.decrements.get(replicaId) || 0
            this.decrements.set(replicaId, Math.max(myCount, count))
        }
    }

    equals(other) {
        if (this.increments.size !== other.increments.size) {
            // the maps have different number of key/value pairs, so they cannot be equal
            return false
        }

        if (this.decrements.size !== other.decrements.size) {
            // the maps have different number of key/value pairs, so they cannot be equal
            return false
        }

        for (const [key, value] of this.increments) {
            if (other.increments.get(key) !== value) {
                // the values for this key are not equal
                return false
            }
        }

        for (const [key, value] of this.decrements) {
            if (other.decrements.get(key) !== value) {
                // the values for this key are not equal
                return false
            }
        }

        // if we get here, all key/value pairs were equal
        return true
    }
}