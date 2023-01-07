import { GCounterDemo, PNCounterDemo } from "/js/g-counter/gcounterDemo.js"

const gCounterDemoEl = document.getElementById('g-counter-demo')
const pnCounterDemoEl = document.getElementById('pn-counter-demo')

const gCounterDemo = new GCounterDemo(gCounterDemoEl)
const pnCounterDemo = new PNCounterDemo(pnCounterDemoEl)

// 1. Grow counter