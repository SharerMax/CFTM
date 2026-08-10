<script setup lang="ts">
import { autocompletion, closeBrackets } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { yaml } from '@codemirror/lang-yaml'
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { linter, lintGutter } from '@codemirror/lint'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { parseDocument } from 'yaml'

const props = withDefaults(defineProps<{
  modelValue: string
  language?: 'yaml' | 'json'
  readOnly?: boolean
  dark?: boolean
}>(), {
  dark: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorElement = ref<HTMLElement | null>(null)
let view: EditorView | null = null

function jsonLint(source: string) {
  try {
    JSON.parse(source)
    return []
  }
  catch (e) {
    const msg = (e as Error).message
    const match = msg.match(/position\s+(\d+)/)
    const pos = match ? Number(match[1]) : 0
    return [{ from: pos, to: pos + 1, severity: 'error' as const, message: msg }]
  }
}

function yamlLint(source: string) {
  const doc = parseDocument(source)
  return doc.errors.map((err) => {
    const from = err.pos?.[0] ?? 0
    return { from, to: from + 1, severity: 'error' as const, message: err.message }
  })
}

const languageExtension = computed(() => {
  switch (props.language) {
    case 'yaml':
      return yaml()
    case 'json':
      return json()
    default:
      return yaml()
  }
})

const lintExtension = computed(() => {
  return linter((view) => {
    const source = view.state.doc.toString()
    return props.language === 'json' ? jsonLint(source) : yamlLint(source)
  })
})

const langCompartment = new Compartment()
const themeCompartment = new Compartment()
const readOnlyCompartment = new Compartment()

const readOnlyExtension = computed(() => (props.readOnly ? [EditorState.readOnly.of(true)] : []))
const themeExtension = computed(() => (props.dark ? [oneDark] : []))

const extensions = [
  lineNumbers(),
  highlightActiveLineGutter(),
  history(),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  lintGutter(),
  themeCompartment.of(themeExtension.value),
  keymap.of([
    ...defaultKeymap,
    ...historyKeymap,
    ...searchKeymap,
    indentWithTab,
  ]),
  langCompartment.of([languageExtension.value, lintExtension.value]),
  readOnlyCompartment.of(readOnlyExtension.value),
  EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      emit('update:modelValue', update.state.doc.toString())
    }
  }),
  EditorView.theme({
    '&': { height: '100%' },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-content': { fontFamily: 'monospace', fontSize: '13px' },
  }),
]

onMounted(() => {
  if (!editorElement.value)
    return

  const state = EditorState.create({
    doc: props.modelValue,
    extensions,
  })

  view = new EditorView({
    state,
    parent: editorElement.value,
  })
})

watch(() => props.language, () => {
  view?.dispatch({
    effects: langCompartment.reconfigure([languageExtension.value, lintExtension.value]),
  })
})

watch(() => props.dark, () => {
  view?.dispatch({
    effects: themeCompartment.reconfigure(themeExtension.value),
  })
})

watch(() => props.readOnly, () => {
  view?.dispatch({
    effects: readOnlyCompartment.reconfigure(readOnlyExtension.value),
  })
})

watch(() => props.modelValue, (newValue) => {
  if (view && view.state.doc.toString() !== newValue) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newValue },
    })
  }
})

onUnmounted(() => {
  view?.destroy()
})
</script>

<template>
  <div ref="editorElement" class="overflow-hidden border border-gray-300 rounded" style="min-height: 300px;" />
</template>
