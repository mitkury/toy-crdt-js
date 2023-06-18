import { GCounterDemo, PNCounterDemo } from "./counters/counterDemos.js"
import { BoardDemo } from "./board/boardDemo.js"
import { TextDemo } from "./text/textDemo.js"

const gCounterDemoEl = document.getElementById('g-counter-demo')
const pnCounterDemoEl = document.getElementById('pn-counter-demo')
const boardDemoEl = document.getElementById('board-demo')
const textDemoEl = document.getElementById('text-demo')

new GCounterDemo(gCounterDemoEl)
new PNCounterDemo(pnCounterDemoEl)
new BoardDemo(boardDemoEl)
new TextDemo(textDemoEl)
