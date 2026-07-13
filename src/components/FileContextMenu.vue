<script setup lang="ts">
import type { ContextMenuItem } from '@/types/contextMenu'

defineProps<{
  show: boolean
  x: number
  y: number
  items: ContextMenuItem[]
}>()

const emit = defineEmits<{ select: [id: string]; close: [] }>()

function onClick(item: ContextMenuItem) {
  if (item.disabled && !item.dev) return
  emit('select', item.id)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="cd-ctx-backdrop" @click="emit('close')" @contextmenu.prevent="emit('close')" />
    <div
      v-if="show"
      class="cd-ctx-menu"
      :style="{ left: `${x}px`, top: `${y}px` }"
      @click.stop
    >
      <template v-for="item in items" :key="item.id">
        <button
          type="button"
          class="cd-ctx-item"
          :class="{
            danger: item.danger,
            disabled: item.disabled && !item.dev,
            'cd-ctx-item--dev': item.dev,
          }"
          :disabled="item.disabled && !item.dev"
          @click="onClick(item)"
        >
          <component :is="item.icon" v-if="item.icon" :size="17" :stroke="1.6" class="cd-ctx-icon" />
          <span class="cd-ctx-label">{{ item.label }}</span>
          <span v-if="item.dev" class="cd-ctx-badge">开发中</span>
        </button>
        <div v-if="item.dividerAfter" class="cd-ctx-divider" />
      </template>
    </div>
  </Teleport>
</template>
