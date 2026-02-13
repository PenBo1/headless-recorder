<template>
  <div class="flex flex-col items-center rounded-md pt-10 h-100">
    <h3 class="text-gray-darkest text-xl font-semibold mb-3 dark:text-gray-lightest">
      暂无录制事件
    </h3>
    <p class="text-gray-dark text-xs mb-5 text-center w-64 dark:text-gray-light">
      点击录制按钮开始记录浏览器事件
    </p>
    <RoundButton :small="false" @click="$emit('start')" class="p-10 mt-12">
      <div class="bg-red w-21 h-21 rounded-full"></div>
    </RoundButton>
  </div>
</template>

<script>
import RoundButton from '@/components/RoundButton'

export default {
  components: { RoundButton },
}
</script>
