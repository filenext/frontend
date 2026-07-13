import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as agentsApi from '@/api/agents'
import type { AgentRow } from '@/types/agents'

export const useAgentsStore = defineStore('agents', () => {
  const items = ref<AgentRow[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  const sidebarAgents = ref<AgentRow[]>([])

  async function load(force = false) {
    if (loading.value) return
    if (loaded.value && !force) return
    loading.value = true
    try {
      const list = await agentsApi.listAllAgents()
      items.value = list
      sidebarAgents.value = list.filter((a) => a.enabled)
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  function agentBySlug(slug: string) {
    return items.value.find((a) => a.slug === slug)
  }

  return { items, sidebarAgents, loaded, loading, load, agentBySlug }
})
