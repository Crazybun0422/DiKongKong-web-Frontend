import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { setTimeout as delay } from 'timers/promises'
import path from 'path'
import process from 'process'

const cwd = path.resolve(process.cwd())

const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], {
  cwd,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
})

server.stdout.setEncoding('utf8')
server.stderr.setEncoding('utf8')

server.stdout.on('data', (data) => {
  process.stdout.write(data)
})

server.stderr.on('data', (data) => {
  process.stderr.write(data)
})

let serverReady = false
const readyRegex = /Local:\s+http:\/\/127\.0\.0\.1:4173/i

server.stdout.on('data', (data) => {
  if (!serverReady && readyRegex.test(data)) {
    serverReady = true
  }
})

await delay(4000)

const browser = await chromium.launch()
const page = await browser.newPage()

page.on('console', (msg) => {
  console.log(`[browser] ${msg.type()}: ${msg.text()}`)
})

await page.addInitScript(() => {
  localStorage.setItem('dikongkong_token', 'debug-token')
})

await page.goto('http://127.0.0.1:4173/settings', {
  waitUntil: 'networkidle',
})

await delay(2000)

await browser.close()
server.kill()
