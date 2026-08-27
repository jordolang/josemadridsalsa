const params = new URLSearchParams(window.location.search)

// Written as text, never as HTML: the reason string comes from Chromium and the
// address from whatever the window was last pointed at.
document.getElementById('target').textContent = params.get('target') || 'Unknown'
document.getElementById('reason').textContent = params.get('reason') || 'Unknown error'

document.getElementById('retry').addEventListener('click', () => {
  window.desktop.retry()
})

document.getElementById('settings').addEventListener('click', () => {
  window.desktop.openSettings()
})
