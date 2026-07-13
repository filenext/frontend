<script setup lang="ts">
import {
  PERM_BIT_ITEMS,
  PERM_MASK_PRESETS,
  hasPerm,
  togglePermBit,
} from '@/utils/permissions'

const model = defineModel<number>({ required: true })

function isChecked(bit: number) {
  return hasPerm(model.value, bit)
}

function onToggle(bit: number, event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  model.value = togglePermBit(model.value, bit, checked)
}

function applyPreset(mask: number) {
  model.value = mask
}
</script>

<template>
  <div class="cd-perm-mask-picker">
    <div class="cd-perm-mask-picker__presets">
      <button
        v-for="preset in PERM_MASK_PRESETS"
        :key="preset.id"
        type="button"
        class="btn btn-sm"
        :class="model === preset.mask ? 'btn-primary' : 'btn-outline-secondary'"
        @click="applyPreset(preset.mask)"
      >
        {{ preset.label }}
      </button>
    </div>
    <div class="cd-perm-mask-picker__grid">
      <label v-for="item in PERM_BIT_ITEMS" :key="item.bit" class="cd-perm-mask-picker__item">
        <input
          class="form-check-input m-0"
          type="checkbox"
          :checked="isChecked(item.bit)"
          @change="onToggle(item.bit, $event)"
        />
        <span class="cd-perm-mask-picker__label">{{ item.label }}</span>
        <span v-if="item.hint" class="cd-perm-mask-picker__hint">{{ item.hint }}</span>
      </label>
    </div>
    <div class="cd-perm-mask-picker__mask text-secondary small">
      权限掩码：<code>{{ model }}</code>
    </div>
  </div>
</template>

<style scoped>
.cd-perm-mask-picker__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.625rem;
}

.cd-perm-mask-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
  gap: 0.375rem 0.75rem;
}

.cd-perm-mask-picker__item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin: 0;
  cursor: pointer;
  user-select: none;
}

.cd-perm-mask-picker__label {
  font-size: 0.8125rem;
  line-height: 1.3;
}

.cd-perm-mask-picker__hint {
  font-size: 0.6875rem;
  color: var(--tblr-secondary);
}

.cd-perm-mask-picker__mask {
  margin-top: 0.5rem;
}
</style>
