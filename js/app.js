import { Editor } from "/js/editor.js"

console.log('Start Toy Editor')

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
    const executiveEditor = editors.find(editor => editor.id == event.detail.editorId)

    if (!executiveEditor.getOnline()) {
        return
    }

    editors.forEach(editor => {
        if (editor.id != executiveEditor.id && editor.getOnline()) {
            editor.executeOperations(event.detail.operations)
        }
    })
}

function shuffleArray_Test(array) {
    let currentIndex = array.length, randomIndex

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex)
        currentIndex--

        // And swap it with the current element.
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

    const currentEditor = editors.find(editor => editor.id == editorId)

    // Sync changes from the editor that was offline to its online peers
    {
        const ops = currentEditor.getOperations()

        //shuffleArray_Test(ops)

        editors.forEach(editor => {
            if (editor.id != editorId && editor.getOnline()) {
                editor.executeOperations(ops)
            }
        })
    }

    // Sync changes from online peers to the editor that was offline
    {
        let ops = []

        editors.forEach(editor => {
            if (editor.id != editorId && editor.getOnline()) {
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