import { Editor } from "/js/editor2.js"

console.log('Start Toy Editor')

const editableNode = document.getElementById('myContentEditable');
const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
        // Do something with the mutation record
    });
});

const config = {
    childList: true,
    subtree: true,
    characterData: true,
    attributeOldValue: true,
    characterDataOldValue: true,
};

observer.observe(editableNode, config);




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