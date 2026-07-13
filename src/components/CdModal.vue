<script setup lang="ts">
const props = defineProps<{
  show: boolean
  title: string
  size?: 'sm' | 'md' | 'lg' | 'full'
}>()

const emit = defineEmits<{ close: [] }>()

function onBackdropClick() {
  if (props.size === 'full') return
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="modal modal-blur show d-block cd-modal-backdrop"
      :class="{ 'cd-modal-backdrop--full': size === 'full' }"
      tabindex="-1"
      @click.self="onBackdropClick"
    >
      <div
        class="modal-dialog"
        :class="{
          'modal-sm': size === 'sm',
          'modal-lg': size === 'lg',
          'modal-dialog-centered': size !== 'full',
          'cd-modal-dialog--full': size === 'full',
        }"
      >
        <div class="modal-content" :class="{ 'cd-modal-content--full': size === 'full' }">
          <div class="modal-header">
            <h5 class="modal-title">{{ title }}</h5>
            <button type="button" class="btn-close" aria-label="关闭" @click="emit('close')" />
          </div>
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
