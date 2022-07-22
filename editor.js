console.log('Start Toy Editor')

const DIV = 'div';
const mainEl = document.querySelector('#main')

createEditor(mainEl)
createEditor(mainEl)
createEditor(mainEl)

function createEditor(inElement) {
    const editorContainerEl = document.createElement(DIV)
    inElement.appendChild(editorContainerEl)
    const editorEl = document.createElement(DIV)
    editorContainerEl.appendChild(editorEl)

    editorContainerEl.classList.add('editor-container')
    editorEl.classList.add('editor')
    editorEl.setAttribute('contenteditable', 'true')
}