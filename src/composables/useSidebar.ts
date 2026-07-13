import { ref, watch } from 'vue'

const STORAGE_KEY = 'cd_sidebar_collapsed'

const collapsed = ref(localStorage.getItem(STORAGE_KEY) === '1')

watch(collapsed, (v) => {
  localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
})

export function useSidebar() {
  function toggle() {
    collapsed.value = !collapsed.value
  }

  function expand() {
    collapsed.value = false
  }

  return { collapsed, toggle, expand }
}
