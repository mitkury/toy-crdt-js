import { Editor } from "/js/text/textEditor.js"

export class TextDemo {
    constructor(mainContainerEl) {
        this.mainContainerEl = mainContainerEl;
        this.editors = [
            new Editor(this.mainContainerEl, 'A'),
            new Editor(this.mainContainerEl, 'B'),
            new Editor(this.mainContainerEl, 'C'),
        ];

        this.editors.forEach(editor => {
            editor.addEventListener('operationsExecuted', this.editorOperationsHandle.bind(this));
            editor.addEventListener('online', this.editorSetOnlineHandle.bind(this));
        });
    }

    editorOperationsHandle(event) {
        const executiveEditor = this.editors.find(editor => editor.getId() === event.detail.editorId);

        if (!executiveEditor.getOnline()) {
            return;
        }

        this.editors.forEach(editor => {
            if (editor.getId() !== executiveEditor.getId() && editor.getOnline()) {
                editor.executeOperations(event.detail.operations);
            }
        });
    }

    editorSetOnlineHandle(event) {
        const { online, editorId } = event.detail;

        if (!online) {
            return;
        }

        const currentEditor = this.editors.find(editor => editor.getId() === editorId);

        // Sync changes from the editor that was offline to its online peers
        {
            const ops = currentEditor.getOperations();

            this.editors.forEach(editor => {
                if (editor.getId() !== editorId && editor.getOnline()) {
                    editor.executeOperations(ops);
                }
            });
        }

        // Sync changes from online peers to the editor that was offline
        {
            let ops = [];

            this.editors.forEach(editor => {
                if (editor.getId() !== editorId && editor.getOnline()) {
                    ops = [
                        ...ops,
                        ...editor.getOperations()
                    ];
                }
            });

            currentEditor.executeOperations(ops);
        }
    }
}
