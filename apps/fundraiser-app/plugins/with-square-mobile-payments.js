/**
 * Expo config plugin for Square's Mobile Payments SDK (mobile-payments-sdk-react-native).
 *
 * Adapted from Square's own Expo sample (example-expo/app.plugin.js in
 * github.com/square/mobile-payments-sdk-react-native), with two differences that matter:
 *
 *  - No access token or location is baked into the app. The phone fetches a short-lived OAuth
 *    token from the storefront (/api/fundraiser-app/square/authorization) after the seller unlocks.
 *  - Tap to Pay on iPhone is switched on with Apple's entitlement, which Apple must grant to the
 *    Apple Developer team first (see the Fundraiser Mobile App docs page).
 *
 * The application id is not a secret: it identifies the app to Square. SQUARE_APPLICATION_ID in
 * the build environment overrides it (e.g. a sandbox app id for a test build).
 */
const fs = require('fs')
const path = require('path')
const {
  createRunOncePlugin,
  withAndroidManifest,
  withAppDelegate,
  withDangerousMod,
  withEntitlementsPlist,
  withGradleProperties,
  withInfoPlist,
  withMainApplication,
  withProjectBuildGradle,
} = require('expo/config-plugins')

const ANDROID_PERMISSIONS = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.RECORD_AUDIO',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.READ_PHONE_STATE',
  'android.permission.NFC',
]

// Square Readers and stands that connect over Lightning / the dock connector.
const IOS_ACCESSORY_PROTOCOLS = ['com.squareup.protocol.stand', 'com.squareup.s089', 'com.squareup.s025', 'com.squareup.s020']

const INFO_PLIST_APP_ID_KEY = 'SquareApplicationID'

function withSquareAndroid(config, { applicationId }) {
  config = withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') return mod
    let contents = mod.modResults.contents
    if (!contents.includes('sdk.squareup.com/public/android')) {
      contents = contents.replace(
        /allprojects\s*\{\s*repositories\s*\{/,
        `allprojects {\n  repositories {\n    maven { url("https://sdk.squareup.com/public/android/") }`
      )
    }
    // Square's SDK is compiled with a newer Kotlin than React Native's Gradle plugin uses; Square's
    // Expo sample needs this flag for the mixed metadata. Remove once the versions line up.
    if (!contents.includes('-Xskip-metadata-version-check')) {
      contents = contents.replace(
        /allprojects\s*\{/,
        `allprojects {
  tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
    compilerOptions { freeCompilerArgs.add("-Xskip-metadata-version-check") }
  }`
      )
    }
    mod.modResults.contents = contents
    return mod
  })

  config = withMainApplication(config, (mod) => {
    if (mod.modResults.language !== 'kt') return mod
    let contents = mod.modResults.contents
    if (!contents.includes('import com.squareup.sdk.mobilepayments.MobilePaymentsSdk')) {
      contents = contents.replace(/package [\w.]+/, '$&\n\nimport com.squareup.sdk.mobilepayments.MobilePaymentsSdk')
    }
    if (!contents.includes('MobilePaymentsSdk.initialize')) {
      contents = contents.replace(/super\.onCreate\(\)/, `$&\n    MobilePaymentsSdk.initialize("${applicationId}", this)`)
    }
    mod.modResults.contents = contents
    return mod
  })

  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest
    manifest['uses-permission'] = manifest['uses-permission'] ?? []
    for (const permission of ANDROID_PERMISSIONS) {
      if (!manifest['uses-permission'].some((p) => p.$?.['android:name'] === permission)) {
        manifest['uses-permission'].push({ $: { 'android:name': permission } })
      }
    }
    return mod
  })

  return withGradleProperties(config, (mod) => {
    const key = 'android.packagingOptions.pickFirsts'
    const value = 'META-INF/versions/9/OSGI-INF/MANIFEST.MF'
    const existing = mod.modResults.find((item) => item.type === 'property' && item.key === key)
    if (!existing) mod.modResults.push({ type: 'property', key, value })
    else if (!existing.value.includes(value)) existing.value += `,${value}`
    return mod
  })
}

function withSquareIos(config, { applicationId, tapToPayOnIPhone }) {
  config = withInfoPlist(config, (mod) => {
    const plist = mod.modResults
    plist[INFO_PLIST_APP_ID_KEY] = applicationId
    plist.UISupportedExternalAccessoryProtocols = Array.from(
      new Set([...(plist.UISupportedExternalAccessoryProtocols ?? []), ...IOS_ACCESSORY_PROTOCOLS])
    )
    plist.NSBluetoothAlwaysUsageDescription ??= 'Bluetooth connects a Square Reader to take card payments.'
    plist.NSBluetoothPeripheralUsageDescription ??= 'Bluetooth connects a Square Reader to take card payments.'
    plist.NSLocationWhenInUseUsageDescription ??= 'Square needs your location to confirm card payments are taken in the US.'
    plist.NSLocationAlwaysAndWhenInUseUsageDescription ??= 'Square needs your location to confirm card payments are taken in the US.'
    plist.NSMicrophoneUsageDescription ??= 'The microphone receives card data from a Square magstripe reader.'
    return mod
  })

  if (tapToPayOnIPhone) {
    config = withEntitlementsPlist(config, (mod) => {
      mod.modResults['com.apple.developer.proximity-reader.payment.acceptance'] = true
      return mod
    })
  }

  config = withAppDelegate(config, (mod) => {
    let contents = mod.modResults.contents
    if (mod.modResults.language !== 'swift') {
      throw new Error('with-square-mobile-payments expects a Swift AppDelegate (Expo SDK 53+).')
    }
    if (!contents.includes('import SquareMobilePaymentsSDK')) {
      // Expo's template starts `internal import Expo`; older ones `import Expo`.
      const anchor = /^(?:internal )?import Expo$/m
      if (!anchor.test(contents)) throw new Error('with-square-mobile-payments: no `import Expo` line in AppDelegate.swift')
      contents = contents.replace(anchor, '$&\nimport SquareMobilePaymentsSDK')
    }
    if (!/didFinishLaunchingWithOptions[^{]*\{/.test(contents)) {
      throw new Error('with-square-mobile-payments: no didFinishLaunchingWithOptions in AppDelegate.swift')
    }
    if (!contents.includes('MobilePaymentsSDK.initialize')) {
      contents = contents.replace(
        /didFinishLaunchingWithOptions[^{]*\{/,
        `$&
    MobilePaymentsSDK.initialize(
      applicationLaunchOptions: launchOptions,
      squareApplicationID: Bundle.main.object(forInfoDictionaryKey: "${INFO_PLIST_APP_ID_KEY}") as! String
    )`
      )
    }
    mod.modResults.contents = contents
    return mod
  })

  // Square's framework ships a setup script that must run as the app's last build phase.
  return withDangerousMod(config, [
    'ios',
    async (mod) => {
      const podfile = path.join(mod.modRequest.platformProjectRoot, 'Podfile')
      if (!fs.existsSync(podfile)) return mod
      let contents = fs.readFileSync(podfile, 'utf8')
      if (!contents.includes('def add_square_setup_build_phase')) {
        contents = contents.replace(
          'prepare_react_native_project!',
          `def add_square_setup_build_phase(installer)
  phase_name = '[SquareMobilePaymentsSDK] setup'
  script = <<-'SCRIPT'
SETUP_SCRIPT="\${BUILT_PRODUCTS_DIR}/\${FRAMEWORKS_FOLDER_PATH}/SquareMobilePaymentsSDK.framework/setup"
if [ -f "$SETUP_SCRIPT" ]; then
  "$SETUP_SCRIPT"
fi
SCRIPT
  installer.aggregate_targets.each do |aggregate_target|
    user_project = aggregate_target.user_project
    next unless user_project
    user_project.native_targets.each do |target|
      next unless target.product_type == 'com.apple.product-type.application'
      target.shell_script_build_phases.select { |phase| phase.name == phase_name }.each(&:remove_from_project)
      phase = target.new_shell_script_build_phase(phase_name)
      phase.shell_script = script
      phase.always_out_of_date = '1'
    end
    user_project.save
  end
end

prepare_react_native_project!`
        )
      }
      if (!/^\s+add_square_setup_build_phase\(installer\)/m.test(contents)) {
        contents = contents.replace(/post_install do \|installer\|\n/, `$&    add_square_setup_build_phase(installer)\n`)
      }
      fs.writeFileSync(podfile, contents)
      return mod
    },
  ])
}

function withSquareMobilePayments(config, options = {}) {
  const applicationId = process.env.SQUARE_APPLICATION_ID || options.applicationId
  if (!applicationId) {
    throw new Error('with-square-mobile-payments needs an applicationId (or SQUARE_APPLICATION_ID in the build environment).')
  }
  const resolved = { applicationId, tapToPayOnIPhone: options.tapToPayOnIPhone !== false }
  config = withSquareAndroid(config, resolved)
  return withSquareIos(config, resolved)
}

module.exports = createRunOncePlugin(withSquareMobilePayments, 'with-square-mobile-payments', '1.0.0')
