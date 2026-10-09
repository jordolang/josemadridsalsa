const PRODUCTION_ENDPOINT = 'https://www.josemadridsalsa.com/admin-desktop'

const input = document.getElementById('endpoint')
const printer = document.getElementById('labelPrinter')
const labelPaper = document.getElementById('labelPaper')
const documentPrinter = document.getElementById('documentPrinter')
const receiptMode = document.getElementById('receiptMode')
const receiptHost = document.getElementById('receiptHost')
const receiptPort = document.getElementById('receiptPort')
const receiptPrinter = document.getElementById('receiptPrinter')

// Filled with the printers Windows knows about. Built with textContent, never
// HTML, since printer names come from the system.
function addPrinter(value, label, select = printer) {
  const option = document.createElement('option')
  option.value = value
  option.textContent = label
  select.appendChild(option)
}

/** Every installed printer, plus a saved one that is no longer installed so it is clear why printing asks. */
function fillPrinters(select, printers, saved, emptyLabel) {
  if (emptyLabel) addPrinter('', emptyLabel, select)
  for (const name of printers) addPrinter(name, name, select)
  if (saved && !printers.includes(saved)) addPrinter(saved, `${saved} (not found)`, select)
  select.value = saved || (emptyLabel ? '' : select.value)
}

function showReceiptFields() {
  document.getElementById('receiptNetwork').hidden = receiptMode.value !== 'network'
  document.getElementById('receiptInstalled').hidden = receiptMode.value !== 'printer'
}
receiptMode.addEventListener('change', showReceiptFields)

function receiptSetting() {
  return {
    mode: receiptMode.value,
    host: receiptHost.value,
    port: Number(receiptPort.value || 9100),
    name: receiptPrinter.value,
  }
}
const message = document.getElementById('message')

function show(text, kind) {
  message.textContent = text
  message.className = `message ${kind}`
}

Promise.all([window.desktop.getSettings(), window.desktop.listPrinters()]).then(([settings, printers]) => {
  fillPrinters(printer, printers, settings.labelPrinter, 'Ask each time')
  fillPrinters(documentPrinter, printers, settings.documentPrinter, 'Ask each time')
  const receipts = settings.receiptPrinter || { mode: 'off' }
  fillPrinters(receiptPrinter, printers, receipts.mode === 'printer' ? receipts.name : '', '')
  labelPaper.value = settings.labelPaper || 'letter'
  receiptMode.value = receipts.mode
  if (receipts.mode === 'network') {
    receiptHost.value = receipts.host
    receiptPort.value = String(receipts.port)
  }
  showReceiptFields()
  input.value = settings.endpoint
  document.getElementById('version').textContent = `Version ${settings.version}`
  input.focus()
  input.select()
})

async function save() {
  await window.desktop.saveLabelPrinter(printer.value)
  const printing = await window.desktop.savePrinting({
    labelPaper: labelPaper.value,
    documentPrinter: documentPrinter.value,
    receiptPrinter: receiptSetting(),
  })
  if (printing && printing.error) {
    show(printing.error, 'error')
    return
  }
  const result = await window.desktop.saveEndpoint(input.value)
  if (result && result.error) {
    show(result.error, 'error')
    return
  }
  input.value = result.url
  show('Saved. Reloading the admin panel…', 'ok')
  setTimeout(() => window.desktop.closeSettings(), 700)
}

document.getElementById('save').addEventListener('click', () => void save())
document.getElementById('cancel').addEventListener('click', () => window.desktop.closeSettings())
document.getElementById('production').addEventListener('click', () => {
  input.value = PRODUCTION_ENDPOINT
  void save()
})

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') void save()
  if (event.key === 'Escape') window.desktop.closeSettings()
})

document.getElementById('testReceipt').addEventListener('click', async () => {
  show('Sending a test ticket…', 'ok')
  const result = await window.desktop.testReceiptPrinter(receiptSetting())
  if (result && result.error) show(result.error, 'error')
  else show('Test ticket sent. If nothing printed, check the connection and the printer name.', 'ok')
})
