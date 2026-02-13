import badge from '@/services/badge'
import browser from '@/services/browser'
import storage from '@/services/storage'
import { popupActions, recordingControls } from '@/services/constants'
import { overlayActions } from '@/modules/overlay/constants'
import { headlessActions } from '@/modules/code-generator/constants'

import CodeGenerator from '@/modules/code-generator'

// Helper to get state
const getState = async () => {
  const { 
    recording = [], 
    isPaused = false, 
    badgeState = '', 
    hasGoto = false, 
    hasViewPort = false,
    isRecording = false
  } = await storage.get(['recording', 'isPaused', 'badgeState', 'hasGoto', 'hasViewPort', 'isRecording'])
  return { recording, isPaused, badgeState, hasGoto, hasViewPort, isRecording }
}

// Helper to set state
const setState = async (newState) => {
  await storage.set(newState)
}

// Initialize listeners
function init() {
  chrome.runtime.onConnect.addListener(port => {
    port.onMessage.addListener(msg => handlePopupMessage(msg))
  })

  chrome.runtime.onMessage.addListener(handleMessage)
  chrome.runtime.onMessage.addListener(handleOverlayMessage)

  chrome.webNavigation.onCompleted.addListener(handleNavigation)
  chrome.webNavigation.onBeforeNavigate.addListener(handleWait)
}

async function start() {
  await cleanUp()

  await setState({
    badgeState: '',
    hasGoto: false,
    hasViewPort: false,
    isRecording: true
  })

  await browser.injectContentScript()
  toggleOverlay({ open: true, clear: true })
  
  badge.start()
}

async function stop() {
  const { recording } = await getState()
  const badgeState = recording.length > 0 ? '1' : ''
  await setState({ badgeState, isRecording: false })
  
  badge.stop(badgeState)
}

async function pause() {
  badge.pause()
  await setState({ isPaused: true })
}

async function unPause() {
  badge.start()
  await setState({ isPaused: false })
}

async function cleanUp() {
  badge.reset()
  await storage.remove(['recording', 'isPaused', 'badgeState', 'hasGoto', 'hasViewPort', 'isRecording'])
}

async function recordCurrentUrl(href) {
  const { hasGoto } = await getState()
  if (!hasGoto) {
    handleMessage({
      selector: undefined,
      value: undefined,
      action: headlessActions.GOTO,
      href,
    })
    await setState({ hasGoto: true })
  }
}

async function recordCurrentViewportSize(value) {
  const { hasViewPort } = await getState()
  if (!hasViewPort) {
    handleMessage({
      selector: undefined,
      value,
      action: headlessActions.VIEWPORT,
    })
    await setState({ hasViewPort: true })
  }
}

function recordNavigation() {
  handleMessage({
    selector: undefined,
    value: undefined,
    action: headlessActions.NAVIGATION,
  })
}

function recordScreenshot(value) {
  handleMessage({
    selector: undefined,
    value,
    action: headlessActions.SCREENSHOT,
  })
}

async function handleMessage(msg, sender) {
  if (msg.control) {
    return handleRecordingMessage(msg, sender)
  }

  if (msg.type === 'SIGN_CONNECT') {
    return
  }

  // NOTE: To account for clicks etc. we need to record the frameId
  // and url to later target the frame in playback
  msg.frameId = sender ? sender.frameId : null
  msg.frameUrl = sender ? sender.url : null

  const { isPaused, recording } = await getState()

  if (!isPaused) {
    recording.push(msg)
    await setState({ recording })
  }
}

async function handleOverlayMessage({ control }) {
  if (!control) {
    return
  }

  if (control === overlayActions.RESTART) {
    await storage.set({ restart: true, clear: false })
    await stop()
    await cleanUp()
    await start()
  }

  if (control === overlayActions.CLOSE) {
    toggleOverlay()
  }

  if (control === overlayActions.COPY) {
    const { options = {} } = await storage.get('options')
    const { recording } = await getState()
    const generator = new CodeGenerator(options)
    const code = generator.generate(recording)

    browser.sendTabMessage({
      action: 'CODE',
      value: options?.code?.showPlaywrightFirst ? code.playwright : code.puppeteer,
    })
  }

  if (control === overlayActions.STOP) {
    await storage.set({ clear: true, pause: false, restart: false })
    await stop()
  }

  if (control === overlayActions.UNPAUSE) {
    await storage.set({ pause: false })
    await unPause()
  }

  if (control === overlayActions.PAUSE) {
    await storage.set({ pause: true })
    await pause()
  }

  // TODO: the next 3 events do not need to be listened in background
  // content script controller, should be able to handle that directly from overlay
  if (control === overlayActions.CLIPPED_SCREENSHOT) {
    browser.sendTabMessage({ action: overlayActions.TOGGLE_SCREENSHOT_CLIPPED_MODE })
  }

  if (control === overlayActions.FULL_SCREENSHOT) {
    browser.sendTabMessage({ action: overlayActions.TOGGLE_SCREENSHOT_MODE })
  }

  if (control === overlayActions.ABORT_SCREENSHOT) {
    browser.sendTabMessage({ action: overlayActions.CLOSE_SCREENSHOT_MODE })
  }
}

async function handleRecordingMessage({ control, href, value, coordinates }) {
  const { badgeState } = await getState()
  
  if (control === recordingControls.EVENT_RECORDER_STARTED) {
    badge.setText(badgeState)
  }

  if (control === recordingControls.GET_VIEWPORT_SIZE) {
    recordCurrentViewportSize(coordinates)
  }

  if (control === recordingControls.GET_CURRENT_URL) {
    recordCurrentUrl(href)
  }

  if (control === recordingControls.GET_SCREENSHOT) {
    recordScreenshot(value)
  }
}

function handlePopupMessage(msg) {
  if (!msg.action) {
    return
  }

  if (msg.action === popupActions.START) {
    start()
  }

  if (msg.action === popupActions.STOP) {
    browser.sendTabMessage({ action: popupActions.STOP })
    stop()
  }

  if (msg.action === popupActions.CLEAN_UP) {
    msg.value && stop()
    toggleOverlay()
    cleanUp()
  }

  if (msg.action === popupActions.PAUSE) {
    if (!msg.stop) {
      browser.sendTabMessage({ action: popupActions.PAUSE })
    }
    pause()
  }

  if (msg.action === popupActions.UN_PAUSE) {
    if (!msg.stop) {
      browser.sendTabMessage({ action: popupActions.UN_PAUSE })
    }
    unPause()
  }
}

async function handleNavigation({ frameId }) {
  // In MV3, we need to be careful about when we inject.
  // We can inject on every navigation or rely on persistent content scripts.
  // The original logic injected on navigation.
  await browser.injectContentScript()
  
  const { isPaused, isRecording } = await getState()
  
  if (isRecording) {
    toggleOverlay({ open: true, pause: isPaused })
  }

  if (frameId === 0 && isRecording) {
    recordNavigation()
  }
}

function handleWait() {
  badge.wait()
}

// TODO: Use a better naming convention for this arguments
function toggleOverlay({ open = false, clear = false, pause = false } = {}) {
  browser.sendTabMessage({ action: overlayActions.TOGGLE_OVERLAY, value: { open, clear, pause } })
}

// Start the listener initialization
init()
