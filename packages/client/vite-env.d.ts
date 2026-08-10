/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/vue" />

declare module 'virtual:uno.css' {
  const css: string
  export default css
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, any>
  export default component
}
