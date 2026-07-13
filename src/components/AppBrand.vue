<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { IconCloud } from '@tabler/icons-vue'
import { useBrandingStore } from '@/stores/branding'

const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    showTagline?: boolean
    linkTo?: string
    iconOnly?: boolean
  }>(),
  { size: 'md', showTagline: false, iconOnly: false },
)

const branding = useBrandingStore()

const logoSize = computed(() => ({ sm: 28, md: 32, lg: 40 }[props.size]))
const nameClass = computed(() => ({ sm: 'fs-6', md: 'fs-5', lg: 'h3' }[props.size]))

const displayText = computed(() => {
  if (branding.settings.logo_text) return branding.settings.logo_text.slice(0, 2)
  return branding.settings.site_name.slice(0, 1).toUpperCase()
})
</script>

<template>
  <RouterLink v-if="linkTo" :to="linkTo" class="cd-brand" :class="[`cd-brand-${size}`]">
    <span class="cd-brand-mark">
      <img v-if="branding.settings.logo_url" :src="branding.settings.logo_url" alt="" class="cd-brand-img" />
      <span v-else-if="branding.settings.logo_text" class="cd-brand-text">{{ displayText }}</span>
      <IconCloud v-else :size="logoSize" :stroke="1.75" />
    </span>
    <span v-if="!iconOnly" class="cd-brand-copy">
      <span class="cd-brand-name" :class="nameClass">{{ branding.settings.site_name }}</span>
      <span v-if="showTagline && branding.settings.tagline" class="cd-brand-tagline">{{ branding.settings.tagline }}</span>
    </span>
  </RouterLink>
  <div v-else class="cd-brand" :class="[`cd-brand-${size}`]">
    <span class="cd-brand-mark">
      <img v-if="branding.settings.logo_url" :src="branding.settings.logo_url" alt="" class="cd-brand-img" />
      <span v-else-if="branding.settings.logo_text" class="cd-brand-text">{{ displayText }}</span>
      <IconCloud v-else :size="logoSize" :stroke="1.75" />
    </span>
    <span v-if="!iconOnly" class="cd-brand-copy">
      <span class="cd-brand-name" :class="nameClass">{{ branding.settings.site_name }}</span>
      <span v-if="showTagline && branding.settings.tagline" class="cd-brand-tagline">{{ branding.settings.tagline }}</span>
    </span>
  </div>
</template>
