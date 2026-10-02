package net.josemadrid.kiosk

import android.app.admin.DeviceAdminReceiver

/** Lets the app be device owner so lock task mode needs no "screen pinning" confirmation. */
class KioskDeviceAdminReceiver : DeviceAdminReceiver()
