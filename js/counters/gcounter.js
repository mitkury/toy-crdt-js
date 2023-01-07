export class GCounter {
    constructor() {
        this.counts = new Map()
    }

    increment(replicaId) {
        let count = this.counts.get(replicaId) || 0
        count++
        this.counts.set(replicaId, count)
    }

    value() {
        let sum = 0
        for (let count of this.counts.values()) {
            sum += count
        }
        return sum
    }

    merge(other) {
        for (let [replicaId, count] of other.counts.entries()) {
            let myCount = this.counts.get(replicaId) || 0
            this.counts.set(replicaId, Math.max(myCount, count))
        }
    }

    equals(other) {
        if (this.counts.size !== other.counts.size) {
            // the maps have different number of key/value pairs, so they cannot be equal
            return false
          }
          
          for (const [key, value] of this.counts) {
            if (other.counts.get(key) !== value) {
              // the values for this key are not equal
              return false
            }
          }
          
          // if we get here, all key/value pairs were equal
          return true
    }
}