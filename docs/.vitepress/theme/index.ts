import DefaultTheme from 'vitepress/theme'
import mediumZoom from 'medium-zoom'
import { onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'
import './custom.css'

export default {
  extends: DefaultTheme,
  setup() {
    const route = useRoute()
    let zoom: ReturnType<typeof mediumZoom> | null = null

    const initZoom = () => {
      zoom?.detach()
      zoom = mediumZoom('.vp-doc img:not(.no-zoom)', {
        background: 'var(--vp-c-bg)',
        margin: 48,
      })
    }

    onMounted(initZoom)
    watch(() => route.path, () => nextTick(initZoom))
  },
}
