<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api/client'
import { pickupSharePagePath, resolvePickupShareToken } from '@/api/shares'

const route = useRoute()
const router = useRouter()
const error = ref('')

onMounted(async () => {
  const raw = route.query.code
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
  if (!code) {
    await router.replace('/login')
    return
  }
  try {
    const shareToken = await resolvePickupShareToken(code)
    await router.replace(pickupSharePagePath(shareToken))
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '取件码无效或已过期'
    await router.replace({ path: '/login', query: { code } })
  }
})
</script>

<template>
  <div class="page page-center cd-pickup-page">
    <div class="container-tight py-5 text-center text-secondary">
      {{ error || '正在打开分享…' }}
    </div>
  </div>
</template>
