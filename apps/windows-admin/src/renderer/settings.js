const PRODUCTION_ENDPOINT = 'https://www.josemadrid.net/admin'

const input = document.getElementById('endpoint')
const message = document.getElementById('message')

function show(text, kind) {
  message.textContent = text
  message.className = `message ${kind}`
}

window.desktop.getSettings().then((settings) => {
  input.value = settings.endpoint
  document.getElementById('version').textContent = `Version ${settings.version}`
  input.focus()
  input.select()
})

async function save() {
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
