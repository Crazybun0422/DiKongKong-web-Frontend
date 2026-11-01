const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const source = fs.readFileSync('src/views/dashboard/SettingsView.vue', 'utf8')
const pollCode = source.slice(source.indexOf('const scheduleAdSyncPoll ='), source.indexOf('const reloadAdSettings ='))
const submitCode = source.slice(source.indexOf('const handleAdSyncNow ='), source.indexOf('const loadCopyContent ='))
const setupCode = source.slice(source.indexOf('const adSyncing ='), source.indexOf('const adLastCrowdLoading ='))

async function main() {
  const notices = []
  let timer, unmount, record = { status: 'RUNNING' }, queryError = false, submits = 0
  const context = vm.createContext({
    ref: value => ({ value }),
    onBeforeUnmount: fn => { unmount = fn },
    setTimeout: fn => { timer = fn; return 1 },
    clearTimeout: () => { timer = null },
    console: { error() {} },
    normalizeAdCrowdRecord: value => value,
    t: key => key,
    message: Object.fromEntries(['success', 'error', 'warning'].map(kind => [kind, text => notices.push([kind, text])])),
    fetchMemberNoAdsLastCrowd: async () => { if (queryError) throw Error('offline'); return record },
    syncMemberNoAdsCrowdNow: async () => { submits++; return { status: 'RUNNING' } },
  })
  vm.runInContext(setupCode + '\nconst adLastCrowdLoading = ref(false); const adLastCrowdRecord = ref(null);\n' + pollCode + submitCode, context)
  const value = name => vm.runInContext(name, context)
  await value('handleAdSyncNow()')
  assert.equal(value('adSyncing.value'), true)
  await value('handleAdSyncNow()')
  assert.equal(submits, 1)
  // A network failure while observing the job must not change the job to FAILED.
  queryError = true
  await timer()
  assert.equal(value('adLastCrowdRecord.value.status'), 'RUNNING')
  assert.equal(notices.filter(([kind]) => kind === 'error').length, 0)
  queryError = false
  record = { status: 'FAILED', errorMessage: '发布免广告人群：errcode=48001' }
  await timer()
  assert.equal(value('adSyncing.value'), false)
  assert.equal(value('adLastCrowdRecord.value.errorMessage'), record.errorMessage)
  assert.equal(timer, null)
  record = { status: 'RUNNING' }
  await value('loadAdLastCrowdRecord()')
  assert.ok(timer)
  unmount()
  assert.equal(timer, null)
  await value('loadAdLastCrowdRecord()')
  assert.equal(timer, null, 'An in-flight response must not restart polling after unmount')
  assert.match(fs.readFileSync('src/services/config.js', 'utf8'), /http\.post\('\/config\/member-no-ads\/sync-start'\)/)
  console.log('Ad sync: background submission, duplicate click, transient query failure, terminal result and unmount passed')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
