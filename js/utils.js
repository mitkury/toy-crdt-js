export function div(inElement, callback) {
    return element('div', inElement, callback)
}

export function span(inElement, callback) {
    return element('span', inElement, callback)
}

export function element(tagName, inElement, callback) {
    const newEl = document.createElement(tagName)
    inElement.appendChild(newEl)
    callback && callback(newEl)
    return newEl
}

export function nodeHasDataId(nodes) {
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].getAttribute('data-id')) {
            return true
        }
    }

    return false
}