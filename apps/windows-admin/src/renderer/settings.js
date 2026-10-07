const PRODUCTION_ENDPOINT = 'https://www.josemadridsalsa.com/admin-desktop'

const input = document.getElementById('endpoint')
const printer = document.getElementById('labelPrinter')

// Filled with the printers Windows knows about. Built with textContent, never
// HTML, since printer names come from the system.
function addPrinter(value, label) {
  const option = document.createElement('option')
  option.value = value
  option.textContent = label
  printer.appendChild(option)
}
const message = document.getElementById('message')

function show(text, kind) {
  message.textContent = text
  message.className = `message ${kind}`
}

Promise.all([window.desktop.getSettings(), window.desktop.listPrinters()]).then(([settings, printers]) => {
  addPrinter('', 'Ask each time')
  for (const name of printers) addPrinter(name, name)
  // A saved printer that is no longer installed still shows, so it is clear why labels ask.
  if (settings.labelPrinter && !printers.includes(settings.labelPrinter)) {
    addPrinter(settings.labelPrinter, `${settings.labelPrinter} (not found)`)
  }
  printer.value = settings.labelPrinter || ''
  input.value = settings.endpoint
  document.getElementById('version').textContent = `Version ${settings.version}`
  input.focus()
  input.select()
})

async function save() {
  await window.desktop.saveLabelPrinter(printer.value)
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
