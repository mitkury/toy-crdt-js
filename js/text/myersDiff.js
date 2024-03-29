'use strict';

const is = (a, b) => a === b;

export const DELETE = 'del';
export const INSERT = 'ins';
export const NOOP = 'nop';
export const REPLACE = 'rep';

export const diff = (original, target, compare) => {
    const eql = compare || is;
    const lcs = (so, eo, st, et) => {
        // separate common head
        while (so < eo && st < et && eql(original[so], target[st])) {
            so++;
            st++;
        }
        // separate common tail
        while (so < eo && st < et && eql(original[eo - 1], target[et - 1])) {
            eo--;
            et--;
        }
        if (so === eo) {
            // only insertions
            while (st < et)
                modb[st++] = 1;
        }
        else if (et === st) {
            // only deletions
            while (so < eo)
                moda[so++] = 1;
        }
        else {
            // no destructuring due Babel bloat
            const path = snake(so, eo, st, et);
            lcs(so, path[0], st, path[1]);
            lcs(path[2], eo, path[3], et);
        }
    };
    const snake = (so, eo, st, et) => {
        const N = eo - so;
        const M = et - st;
        const kdn = so - st;
        const kup = eo - et;
        const delta = N - M;
        const deltaOdd = delta & 1;
        const Dmax = (N + M + 1) / 2;
        down[kdn + 1] = so;
        up[kup - 1] = eo;
        for (let D = 0; D <= Dmax; D++) {
            let k = 0, x = 0, y = 0;
            // forward path
            for (k = kdn - D; k <= kdn + D; k += 2) {
                if (k === kdn - D)
                    x = down[k + 1]; // down
                else {
                    x = down[k - 1] + 1; // right
                    if ((k < kdn + D) && (x <= down[k + 1]))
                        x = down[k + 1]; // down
                }
                y = x - k;
                // diagonal
                while (x < eo && y < et && eql(original[x], target[y])) {
                    x++;
                    y++;
                }
                down[k] = x;
                if (deltaOdd && (kup - D < k) && (k < kup + D) && up[k] <= down[k])
                    return [down[k], down[k] - k, up[k], up[k] - k];
            }
            // reverse path
            for (k = kup - D; k <= kup + D; k += 2) {
                if (k === kup + D)
                    x = up[k - 1]; // up
                else {
                    x = up[k + 1] - 1; // left
                    if ((k > kup - D) && (up[k - 1] < x))
                        x = up[k - 1]; // up
                }
                y = x - k;
                // diagonal
                while (x > so && y > st && eql(original[x - 1], target[y - 1])) {
                    x--;
                    y--;
                }
                up[k] = x;
                if (!deltaOdd && (kdn - D <= k) && (k <= kdn + D) && up[k] <= down[k])
                    return [down[k], down[k] - k, up[k], up[k] - k];
            }
        }
    };
    const originalLength = original.length;
    const targetLength = target.length;
    const moda = new Int8Array(originalLength);
    const modb = new Int8Array(targetLength);
    const up = {};
    const down = {};
    const changes = [];
    let so = 0;
    let st = 0;
    lcs(so, originalLength, st, targetLength);
    while (so < originalLength || st < targetLength) {
        if (so < originalLength && st < targetLength) {
            if (!moda[so] && !modb[st]) {
                changes.push(NOOP);
                so++;
                st++;
                continue;
            }
            else if (moda[so] && modb[st]) {
                changes.push(REPLACE);
                so++;
                st++;
                continue;
            }
        }
        if (so < originalLength && (targetLength <= st || moda[so])) {
            changes.push(DELETE);
            so++;
        }
        if (st < targetLength && (originalLength <= so || modb[st])) {
            changes.push(INSERT);
            st++;
        }
    }
    return changes;
};