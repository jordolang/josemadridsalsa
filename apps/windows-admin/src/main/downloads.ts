import { Notification, shell } from 'electron'
import type { Session } from 'electron'
import { basename } from 'node:path'

/**
 * The admin panel exports a lot of files — CSV reports, invoice and packing-slip
 * PDFs, shipping labels, media. In a browser those vanish into the downloads
 * folder; here the OS save dialog runs, and a finished download offers to show
 * itself in Explorer.
 */
export function registerDownloadHandling(session: Session): void {
  session.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({
      title: 'Save file',
      defaultPath: item.getFilename(),
    })

    item.once('done', (_doneEvent, state) => {
      if (state !== 'completed') {
        // 'cancelled' is the user closing the save dialog — not something to report.
        if (state === 'interrupted') {
          new Notification({
            title: 'Download failed',
            body: `${item.getFilename()} did not finish downloading.`,
          }).show()
        }
        return
      }

      const savedPath = item.getSavePath()
      const notification = new Notification({
        title: 'Download complete',
        body: basename(savedPath),
      })
      notification.on('click', () => shell.showItemInFolder(savedPath))
      notification.show()
    })
  })
}
