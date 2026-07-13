import { ref, watch } from 'vue'

const STORAGE_KEY = 'cd_file_sidebar_collapsed'

const collapsed = ref(localStorage.getItem(STORAGE_KEY) === '1')

watch(collapsed, (v) => {
  localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
})

export function useFileSidebar() {
  function toggle() {
    collapsed.value = !collapsed.value
  }

  return { collapsed, toggle }
}
