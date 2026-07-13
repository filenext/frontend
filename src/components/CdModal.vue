<script setup lang="ts">
defineProps<{
  show: boolean
  title: string
  size?: 'sm' | 'md' | 'lg'
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="modal modal-blur show d-block cd-modal-backdrop"
      tabindex="-1"
      @click.self="emit('close')"
    >
      <div
        class="modal-dialog modal-dialog-centered"
        :class="{ 'modal-sm': size === 'sm', 'modal-lg': size === 'lg' }"
      >
        <div class="modal-content">
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
