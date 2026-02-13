const CONTENT_SCRIPT_PATH = 'js/content-script.js'
// const RUN_URL = 'https://app.checklyhq.com/checks/new/browser'
const DOCS_URL = 'https://www.checklyhq.com/docs/headless-recorder'
// const SIGNUP_URL =
//   'https://www.checklyhq.com/product/synthetic-monitoring/?utm_source=Chrome+Extension&utm_medium=Headless+Recorder+Chrome+Extension&utm_campaign=Headless+Recorder&utm_id=Open+Source'

export default {
  getActiveTab() {
    return new Promise(function(resolve) {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => resolve(tab))
    })
  },

  async sendTabMessage({ action, value, clean } = {}) {
    const tab = await this.getActiveTab()
    chrome.tabs.sendMessage(tab.id, { action, value, clean })
  },

  async injectContentScript() {
    const tab = await this.getActiveTab()
    return new Promise(function(resolve) {
      if (chrome.scripting) {
        chrome.scripting.executeScript(
          { target: { tabId: tab.id }, files: [CONTENT_SCRIPT_PATH] },
          res => resolve(res)
        )
      } else {
        // Fallback or error handling
        resolve()
      }
    })
  },

  copyToClipboard(text) {
    return navigator.permissions.query({ name: 'clipboard-write' })
      .then(result => {
      if (result.state !== 'granted' && result.state !== 'prompt') {
        return Promise.reject()
      }

      navigator.clipboard.writeText(text)
    })
  },

  getChecklyCookie() {
    // return new Promise(function(resolve) {
    //   chrome.cookies.getAll({}, res =>
    //     resolve(res.find(cookie => cookie.name.startsWith('checkly_has_account')))
    //   )
    // })
    return Promise.resolve(false)
  },

  getBackgroundBus() {
    return chrome.runtime.connect({ name: 'recordControls' })
  },

  openOptionsPage() {
    chrome.runtime.openOptionsPage?.()
  },

  openHelpPage() {
    chrome.tabs.create({ url: DOCS_URL })
  },

  // openChecklyRunner({ code, runner, isLoggedIn }) {
  //   if (!isLoggedIn) {
  //     chrome.tabs.create({ url: SIGNUP_URL })
  //     return
  //   }

  //   const script = encodeURIComponent(btoa(code))
  //   const url = `${RUN_URL}?framework=${runner}&script=${script}`
  //   chrome.tabs.create({ url })
  // },
}
