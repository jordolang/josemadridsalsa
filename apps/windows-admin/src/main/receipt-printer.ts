import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ReceiptPrinter } from '../shared/receipts'

/**
 * Delivering ESC/POS bytes to the receipt printer.
 *
 * Over Ethernet that is a raw TCP connection to the printer's port 9100. Over
 * USB it is the printer installed in the system with the manufacturer's
 * driver, sent the bytes as a RAW job so the driver passes them through
 * instead of trying to lay them out as a page: the Windows spooler's
 * WritePrinter, or CUPS `lp -o raw` on a Mac or Linux.
 */

const NETWORK_TIMEOUT_MS = 8000

function sendOverNetwork(host: string, port: number, bytes: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port })
    socket.setTimeout(NETWORK_TIMEOUT_MS, () => socket.destroy(new Error(`${host}:${port} did not answer`)))
    socket.once('error', reject)
    socket.once('connect', () => socket.end(bytes))
    socket.once('close', (hadError) => {
      if (!hadError) resolve()
    })
  })
}

/**
 * The spooler's raw path, from PowerShell so the app needs no native module.
 * The printer name and the file arrive as arguments, never spliced into code.
 */
const WINDOWS_RAW_PRINT = `
param([string]$Printer, [string]$Path)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class JmsRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DocInfo { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern int StartDocPrinter(IntPtr handle, int level, [In] DocInfo info);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool WritePrinter(IntPtr handle, byte[] bytes, int count, out int written);
  public static void Send(string name, byte[] bytes) {
    IntPtr handle;
    if (!OpenPrinter(name, out handle, IntPtr.Zero)) throw new Win32Exception();
    try {
      if (StartDocPrinter(handle, 1, new DocInfo { pDocName = "Order ticket", pDataType = "RAW" }) == 0) throw new Win32Exception();
      try {
        StartPagePrinter(handle);
        int written;
        if (!WritePrinter(handle, bytes, bytes.Length, out written)) throw new Win32Exception();
        EndPagePrinter(handle);
      } finally { EndDocPrinter(handle); }
    } finally { ClosePrinter(handle); }
  }
}
'@
[JmsRawPrinter]::Send($Printer, [IO.File]::ReadAllBytes($Path))
`

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 30_000, windowsHide: true }, (error, _stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message))
      else resolve()
    })
  })
}

async function sendToSystemPrinter(name: string, bytes: Buffer): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'jms-receipt-'))
  try {
    const ticket = join(dir, 'ticket.bin')
    await writeFile(ticket, bytes)
    if (process.platform === 'win32') {
      const script = join(dir, 'print.ps1')
      await writeFile(script, WINDOWS_RAW_PRINT, 'utf8')
      await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, name, ticket])
    } else {
      await run('lp', ['-d', name, '-o', 'raw', ticket])
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export function sendToReceiptPrinter(printer: ReceiptPrinter, bytes: Buffer): Promise<void> {
  switch (printer.mode) {
    case 'network':
      return sendOverNetwork(printer.host, printer.port, bytes)
    case 'printer':
      return sendToSystemPrinter(printer.name, bytes)
    case 'off':
      return Promise.resolve()
  }
}
