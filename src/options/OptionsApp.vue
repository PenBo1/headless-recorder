<template>
  <main class="bg-gray-lightest flex py-9 w-full h-screen overflow-auto dark:bg-black">
    <div class="flex flex-col w-1/4 pt-12 pr-6">
      <a href="https://www.checklyhq.com/docs/headless-recorder/" target="_blank">文档</a>
      <a href="https://github.com/checkly/headless-recorder" target="_blank">GitHub</a>
      <a href="https://github.com/checkly/headless-recorder/blob/main/CHANGELOG.md"
        >发布说明</a
      >
      <a
        href="https://chrome.google.com/webstore/detail/headless-recorder/djeegiggegleadkkbgopoonhjimgehda"
        target="_blank"
        >Chrome 商店</a
      >
    </div>
    <div class="flex flex-col w-1/2">
      <header class="flex flex-row justify-between items-center mb-3.5">
        <div class="flex items-baseline">
          <h1 class="text-blue text-2xl font-bold mr-1">
            Headless Recorder
          </h1>
          <span class="text-gray-dark dark:text-gray-light text-sm">v{{ version }}</span>
        </div>
        <span
          role="alert"
          class="text-gray-darkest dark:text-white text-base font-semibold"
          v-show="saving"
          >保存中...</span
        >
      </header>

      <section>
        <h2>录制器设置</h2>
        <label for="custom-data-attribute">自定义数据属性</label>
        <div class="mb-6">
          <input
            id="custom-data-attribute"
            class="w-full placeholder-gray-darkish bg-gray-lighter h-7 rounded px-2 mb-2 text-sm"
            type="text"
            v-model.trim="options.code.dataAttribute"
            @change="save"
            placeholder="您的自定义 data-* 属性"
          />
          <p>
            定义一个我们在选择元素时尝试使用的属性，例如
            "data-custom"。这在 React 或 Vue 应用生成随机类名时非常有用。
          </p>
          <p>
            <span role="img" aria-label="siren">🚨</span>
            <span class="ml-1 font-bold text-black-shady dark:text-white"
              >当设置了 <span class="italic">"自定义数据属性"</span>&nbsp; 时，它将优先于任何其他选择器（甚至 ID）
            </span>
          </p>
        </div>
        <div>
          <label>设置按键代码</label>
          <div class="mb-2">
            <Button @click="listenForKeyCodePress" class="font-semibold text-white text-sm">
              {{ recordingKeyCodePress ? '捕获中...' : '录制按键' }}
            </Button>
            <span class="text-gray-dark dark:text-gray-light text-sm ml-3">
              {{ options.code.keyCode }}
            </span>
          </div>
          <p>
            用于捕获输入更改的按键。此处的值是按键代码。不支持多个按键组合。
          </p>
        </div>
      </section>

      <section>
        <h2>代码生成器设置</h2>
        <Toggle v-model="options.code.wrapAsync">
          将代码包裹在异步函数中
        </Toggle>
        <Toggle v-model="options.code.headless">
          在 playwright/puppeteer 启动选项中设置 <code>headless</code>
        </Toggle>
        <Toggle v-model="options.code.waitForNavigation">
          在导航时添加 <code>waitForNavigation</code> 行
        </Toggle>
        <Toggle v-model="options.code.waitForSelectorOnClick">
          在每个 <code>page.click()</code> 之前添加 <code>waitForSelector</code> 行
        </Toggle>
        <Toggle v-model="options.code.blankLinesBetweenBlocks">
          在代码块之间添加空行
        </Toggle>
        <Toggle v-model="options.code.showPlaywrightFirst">
          优先显示 Playwright 标签页
        </Toggle>
      </section>

      <section>
        <h2 class="">扩展设置</h2>
        <Toggle v-model="options.extension.darkMode">
          使用深色模式 {{ options.extension.darkMode }}
        </Toggle>
        <!-- <Toggle v-model="options.extension.telemetry">
          允许记录使用遥测数据
        </Toggle>
        <p>
          我们仅记录点击数据用于基础产品开发，不会记录网站内容或输入数据。
          数据绝不会与第三方共享。
        </p> -->
      </section>
    </div>
  </main>
</template>

<script>
import { version } from '../../package.json'

import storage from '@/services/storage'
import { isDarkMode } from '@/services/constants'
import { defaults as code } from '@/modules/code-generator/base-generator'
import { merge } from 'lodash'

import Button from '@/components/Button'
import Toggle from '@/components/Toggle'

const defaultOptions = {
  code,
  extension: {
    // telemetry: true,
    darkMode: isDarkMode(),
  },
}

export default {
  name: 'OptionsApp',
  components: { Toggle, Button },

  data() {
    return {
      version,
      loading: true,
      saving: false,
      options: defaultOptions,
      recordingKeyCodePress: false,
    }
  },

  watch: {
    options: {
      handler() {
        this.save()
      },
      deep: true,
    },

    'options.extension.darkMode': {
      handler(newVal) {
        document.body.classList[newVal ? 'add' : 'remove']('dark')
      },
      immediate: true,
    },
  },

  mounted() {
    this.load()
    chrome.storage.onChanged.addListener(({ options = null }) => {
      if (options && options.newValue.extension.darkMode !== this.options.extension.darkMode) {
        this.options.extension.darkMode = options.newValue.extension.darkMode
      }
    })
  },

  methods: {
    async save() {
      this.saving = true
      await storage.set({ options: this.options })

      setTimeout(() => (this.saving = false), 500)
    },

    async load() {
      const { options } = await storage.get('options')
      merge(defaultOptions, options)
      this.options = Object.assign({}, this.options, defaultOptions)

      this.loading = false
    },

    listenForKeyCodePress() {
      this.recordingKeyCodePress = true

      const keyDownFunction = e => {
        this.recordingKeyCodePress = false
        this.updateKeyCodeWithNumber(e)
        window.removeEventListener('keydown', keyDownFunction, false)
        e.preventDefault()
      }

      window.addEventListener('keydown', keyDownFunction, false)
    },

    updateKeyCodeWithNumber(evt) {
      this.options.code.keyCode = parseInt(evt.keyCode, 10)
      this.save()
    },
  },
}
</script>

<style scoped>
body {
  background: #f9fafc;
  height: 100vh;
}

body.dark {
  background: #161616;
}

code {
  @apply font-semibold;
}

a {
  @apply text-blue underline text-sm text-right;
}

h2 {
  @apply text-gray-darkish text-xl font-semibold mb-5 dark:text-gray-light;
}

label {
  color: #000;
  @apply font-semibold text-sm mb-2 block dark:text-gray-lightest;
}

section {
  @apply bg-white border-gray-light border border-solid rounded-md p-4 pb-10 mb-6 dark:bg-black-shady dark:border-gray-dark;
}

p {
  @apply text-gray-darkish text-xs mb-2 dark:text-white;
}
</style>
