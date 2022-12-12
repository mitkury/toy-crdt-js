import { element, div, span, nodeHasDataId } from "/js/utils.js"
import { OpId } from "/js/crdt/opId.js"
import { TextCrdt } from "/js/crdt/textCrdt.js"
import { ActivationOperation, CreationOperation } from "/js/crdt/operations.js"
import { diff, NOOP, REPLACE, DELETE, INSERT } from "/js/myersDiff.js"

export class EditorNode {

}