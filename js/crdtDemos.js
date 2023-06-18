import { GCounterDemo, PNCounterDemo } from "/js/counters/counterDemos.js"
import { BoardDemo } from "/js/board/boardDemo.js"
import { TextDemo } from "/js/text/textDemo.js"

const gCounterDemoEl = document.getElementById('g-counter-demo')
const pnCounterDemoEl = document.getElementById('pn-counter-demo')
const boardDemoEl = document.getElementById('board-demo')
const textDemoEl = document.getElementById('text-demo')

new GCounterDemo(gCounterDemoEl)
new PNCounterDemo(pnCounterDemoEl)
new BoardDemo(boardDemoEl)
new TextDemo(textDemoEl)
