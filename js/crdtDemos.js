import { GCounterDemo, PNCounterDemo } from "/js/counters/counterDemos.js"
import { BoardDemo } from "/js/board/boardDemo.js"

const gCounterDemoEl = document.getElementById('g-counter-demo')
const pnCounterDemoEl = document.getElementById('pn-counter-demo')
const boardDemoEl = document.getElementById('board-demo')

new GCounterDemo(gCounterDemoEl)
new PNCounterDemo(pnCounterDemoEl)
new BoardDemo(boardDemoEl)
