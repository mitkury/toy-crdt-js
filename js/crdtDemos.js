import { GCounterDemo, PNCounterDemo } from "/js/counters/counterDemos.js"
import { BoardDemo } from "/js/board/boardDemo.js"

const gCounterDemoEl = document.getElementById('g-counter-demo')
const pnCounterDemoEl = document.getElementById('pn-counter-demo')
const boardDemoEl = document.getElementById('board-demo')

const gCounterDemo = new GCounterDemo(gCounterDemoEl)
const pnCounterDemo = new PNCounterDemo(pnCounterDemoEl)
const boardDemo = new BoardDemo(boardDemoEl)
