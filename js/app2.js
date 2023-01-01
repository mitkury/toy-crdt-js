import { Editor } from "/js/editor2.js"

console.log('Start Toy Editor')

/*
const editableNode = document.getElementById('myContentEditable');
const observer = new MutationObserver(function (mutations) {
    stopObservingMutations()

    // For each mutation record...
    for (const mutation of mutations) {
        // If the mutation is a childList mutation (i.e. nodes were added or removed)...
        if (mutation.type === 'childList') {
            // For each node that was added...
            for (const node of mutation.addedNodes) {
                // Remove the node from the DOM
                node.remove();
            }
            // For each node that was removed...
            for (const node of mutation.removedNodes) {
                // Re-add the node to the DOM at the same position it was removed from
                if (mutation.nextSibling) {
                    mutation.target.insertBefore(node, mutation.nextSibling);
                } else {
                    mutation.target.appendChild(node);
                }
            }
        }
        // If the mutation is an attribute mutation (i.e. an attribute was added, modified, or removed)...
        else if (mutation.type === 'attributes') {
            // If the attribute was modified or removed...
            if (mutation.oldValue) {
                // Set the attribute to its previous value
                mutation.target.setAttribute(mutation.attributeName, mutation.oldValue);
            }
            // If the attribute was added...
            else {
                // Remove the attribute
                mutation.target.removeAttribute(mutation.attributeName);
            }
        }
        // If the mutation is a characterData mutation (i.e. the data of a text node was modified)...
        else if (mutation.type === 'characterData') {
            // Set the text node's data to its previous value
            mutation.target.data = mutation.oldValue;
        }
    }

    observeMutations()
});

const config = {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
    attributeOldValue: true,
    characterDataOldValue: true,
};

observeMutations()

function observeMutations() {
    observer.observe(editableNode, config)
}

function stopObservingMutations() {
    observer.disconnect()
}
*/


const mainContainerEl = document.getElementById('editors')

const editors = [
    new Editor(mainContainerEl, 'A'),
    new Editor(mainContainerEl, 'B'),
    new Editor(mainContainerEl, 'C'),
]

editors.forEach(editor => {
    editor.addEventListener('operationsExecuted', editorOperationsHandle)
    editor.addEventListener('online', editorSetOnlineHandle)
})

function editorOperationsHandle(event) {
    const executiveEditor = editors.find(editor => editor.getId() == event.detail.editorId)

    if (!executiveEditor.getOnline()) {
        return
    }

    editors.forEach(editor => {
        if (editor.getId() != executiveEditor.getId() && editor.getOnline()) {
            editor.executeOperations(event.detail.operations)
        }
    })
}

function shuffleArray_Test(array) {
    let currentIndex = array.length, randomIndex

    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex)
        currentIndex--

        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]]
    }

    return array
}

function editorSetOnlineHandle(event) {
    const { online, editorId } = event.detail

    // Handle the editor going back online
    if (!online) {
        return
    }

    const currentEditor = editors.find(editor => editor.getId() == editorId)

    // Sync changes from the editor that was offline to its online peers
    {
        const ops = currentEditor.getOperations()

        //shuffleArray_Test(ops)

        editors.forEach(editor => {
            if (editor.getId() != editorId && editor.getOnline()) {
                editor.executeOperations(ops)
            }
        })
    }

    // Sync changes from online peers to the editor that was offline
    {
        let ops = []

        editors.forEach(editor => {
            if (editor.getId() != editorId && editor.getOnline()) {
                ops = [
                    ...ops,
                    ...editor.getOperations()
                ]
            }
        })

        //shuffleArray_Test(ops)

        currentEditor.executeOperations(ops)
    }

}