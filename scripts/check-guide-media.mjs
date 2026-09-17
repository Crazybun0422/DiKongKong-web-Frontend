import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { extractGuideMedia, isGuideVideo } from '../src/utils/guideMedia.js'

const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 32]), Buffer.from('ftypisom'), Buffer.alloc(20)]).toString('base64')
assert.equal(extractGuideMedia(mp4), `data:video/mp4;base64,${mp4}`)
assert.equal(extractGuideMedia(` \n${mp4.slice(0, 12)}\n${mp4.slice(12)} `), `data:video/mp4;base64,${mp4}`)
assert.equal(extractGuideMedia(`data:video/mp4;base64,${mp4}`), `data:video/mp4;base64,${mp4}`)
assert.equal(extractGuideMedia(`<video src="data:video/mp4;base64,${mp4}"></video>`), `data:video/mp4;base64,${mp4}`)
assert.match(extractGuideMedia(Buffer.from('GIF89a').toString('base64')), /^data:image\/gif;base64,/)
assert.throws(() => extractGuideMedia(Buffer.from('not a media file').toString('base64')))
assert.throws(() => extractGuideMedia('data:text/html;base64,PHNjcmlwdD4='))
assert.throws(() => extractGuideMedia('%%%'))
if (process.argv[2]) {
  const input = readFileSync(process.argv[2], 'utf8').trim()
  const output = extractGuideMedia(input)
  assert.ok(isGuideVideo(output))
  assert.equal(output.split(',')[1], input.replace(/\s/g, ''))
  console.log('User pasted video recognized; Base64 payload preserved.')
}
console.log('PASS: raw Base64 recognition, whitespace, data URI, HTML, GIF, invalid media')
