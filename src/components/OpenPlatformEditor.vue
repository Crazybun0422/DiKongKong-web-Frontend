<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BoldOutlined,
  ClearOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  PictureOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons-vue'

import { uploadPublicFile } from '../services/files'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const editorRef = ref(null)
const imageInputRef = ref(null)
const colorInputRef = ref(null)
const editorContent = ref(props.modelValue || '')
const isFocused = ref(false)
const headingValue = ref('paragraph')
const fontSizeValue = ref('14px')
const selectedTextColor = ref('#111111')
const colorHexInput = ref('#111111')
const savedRange = ref(null)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const TEXT_COLOR_PRESETS = ['#111111', '#cf1322', '#d46b08', '#1677ff', '#389e0d', '#722ed1']
const FONT_SIZE_OPTIONS = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px', '64px']

const hasContent = computed(() => {
  const html = editorContent.value || ''
  if (/<(img|video|iframe|object|embed)/i.test(html)) return true
  const text = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()
  return text.length > 0
})

const getPopupContainer = (trigger) => trigger?.parentNode || document.body

const syncContent = () => {
  if (!editorRef.value) return
  const html = editorRef.value.innerHTML
  editorContent.value = html
  emit('update:modelValue', html)
}

const ensureEditorFocus = () => {
  if (typeof document === 'undefined' || !editorRef.value) return
  editorRef.value.focus()
}

const normalizeHexColor = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  const normalized = raw.startsWith('#') ? raw : `#${raw}`
  if (/^#([0-9a-fA-F]{6})$/.test(normalized)) return normalized.toLowerCase()
  if (/^#([0-9a-fA-F]{3})$/.test(normalized)) {
    const [, short] = normalized.match(/^#([0-9a-fA-F]{3})$/) || []
    if (!short) return null
    return `#${short.split('').map((char) => `${char}${char}`).join('')}`.toLowerCase()
  }
  return null
}

const normalizeFontSize = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return null
  if (/^\d+px$/.test(raw)) return raw
  if (/^\d+$/.test(raw)) return `${raw}px`
  return null
}

const saveSelectionRange = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !editorRef.value) return
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0)
  if (range.collapsed) return
  const container = range.commonAncestorContainer
  const host = container?.nodeType === Node.ELEMENT_NODE ? container : container?.parentNode
  if (host && editorRef.value.contains(host)) {
    savedRange.value = range.cloneRange()
  }
}

const restoreSelectionRange = () => {
  if (typeof window === 'undefined' || !savedRange.value) return false
  const selection = window.getSelection()
  if (!selection) return false
  selection.removeAllRanges()
  selection.addRange(savedRange.value)
  return true
}

const getActiveRange = () => {
  const current = getSelectionRange()
  if (current && !current.collapsed) {
    return current.cloneRange()
  }
  if (savedRange.value && !savedRange.value.collapsed) {
    return savedRange.value.cloneRange()
  }
  return null
}

const getSelectionRange = () => {
  if (typeof window === 'undefined') return null
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  return selection.getRangeAt(0)
}

const syncToolbarStateFromSelection = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !editorRef.value) {
    headingValue.value = 'paragraph'
    return
  }
  const range = getSelectionRange()
  if (!range) {
    headingValue.value = 'paragraph'
    return
  }
  const container = range.commonAncestorContainer
  const host = container?.nodeType === Node.ELEMENT_NODE ? container : container?.parentNode
  if (!range.collapsed && host && editorRef.value.contains(host)) {
    savedRange.value = range.cloneRange()
  }

  let node = range.startContainer
  let foundHeading = false
  while (node && node !== editorRef.value) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.nodeName
      if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
        headingValue.value = tag.toLowerCase()
        foundHeading = true
        break
      }
    }
    node = node.parentNode
  }
  if (!foundHeading) {
    headingValue.value = 'paragraph'
  }

  const parentElement =
    range.startContainer?.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer?.parentElement
  if (parentElement) {
    const style = window.getComputedStyle(parentElement)
    const size = normalizeFontSize(style.fontSize)
    const color = normalizeHexColor(style.color?.match(/\d+/g)?.length
      ? `#${style.color.match(/\d+/g).slice(0, 3).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`
      : style.color)
    if (size) fontSizeValue.value = size
    if (color) {
      selectedTextColor.value = color
      colorHexInput.value = color
    }
  }
}

watch(
  () => props.modelValue,
  (value) => {
    const safeValue = value || ''
    if (safeValue !== editorContent.value) {
      editorContent.value = safeValue
      if (editorRef.value && editorRef.value.innerHTML !== safeValue) {
        editorRef.value.innerHTML = safeValue
      }
    }
  },
)

watch(selectedTextColor, (value) => {
  colorHexInput.value = value
})

const handleInput = () => {
  syncContent()
  syncToolbarStateFromSelection()
}

const handleFocus = () => {
  isFocused.value = true
  saveSelectionRange()
  syncToolbarStateFromSelection()
}

const handleBlur = () => {
  isFocused.value = false
  saveSelectionRange()
  syncContent()
}

const applyCommand = (command, value = null) => {
  if (props.disabled || typeof document === 'undefined') return
  ensureEditorFocus()
  restoreSelectionRange()
  document.execCommand(command, false, value)
  syncContent()
  saveSelectionRange()
  syncToolbarStateFromSelection()
}

const wrapSelectionWithStyle = (styleText) => {
  if (props.disabled || typeof document === 'undefined') return
  const range = getActiveRange()
  if (!range) return

  if (range.collapsed) {
    message.warning('请先选中要设置样式的文字')
    return
  }

  const wrapper = document.createElement('span')
  wrapper.setAttribute('style', styleText)
  try {
    const contents = range.extractContents()
    wrapper.appendChild(contents)
    range.insertNode(wrapper)
    range.selectNodeContents(wrapper)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedRange.value = range.cloneRange()
    syncContent()
    saveSelectionRange()
    syncToolbarStateFromSelection()
  } catch (error) {
    console.error('Failed to wrap selection style', error)
  }
}

const clearStyleOnFragment = (fragment, styleKeys = []) => {
  if (!fragment || !Array.isArray(styleKeys) || !styleKeys.length) return
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT)
  const targets = []
  let current = walker.nextNode()
  while (current) {
    targets.push(current)
    current = walker.nextNode()
  }
  targets.forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    styleKeys.forEach((styleKey) => {
      node.style?.removeProperty(styleKey)
    })
    const styleAttr = node.getAttribute('style') || ''
    if (!styleAttr.trim()) {
      node.removeAttribute('style')
    }
  })
}

const isWhitespaceTextNode = (node) => {
  if (!node || node.nodeType !== Node.TEXT_NODE) return false
  return !node.textContent?.replace(/\u00a0/g, ' ').trim()
}

const hasOnlyMeaningfulChild = (element, child) => {
  if (!element || !child) return false
  const meaningfulChildren = Array.from(element.childNodes).filter((node) => !isWhitespaceTextNode(node))
  return meaningfulChildren.length === 1 && meaningfulChildren[0] === child
}

const unwrapElement = (element) => {
  const parent = element?.parentNode
  if (!parent) return null
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element)
  }
  parent.removeChild(element)
  return parent
}

const normalizeStyledAncestors = (node, styleKeys = []) => {
  if (!node || !Array.isArray(styleKeys) || !styleKeys.length || !editorRef.value) return node

  let currentNode = node
  let ancestor = currentNode.parentNode

  while (ancestor && ancestor !== editorRef.value) {
    if (!(ancestor instanceof HTMLElement)) {
      ancestor = ancestor.parentNode
      continue
    }

    if (!hasOnlyMeaningfulChild(ancestor, currentNode)) break

    styleKeys.forEach((styleKey) => {
      ancestor.style?.removeProperty(styleKey)
    })

    if (ancestor.tagName === 'SPAN' && !ancestor.getAttribute('style')) {
      const nextAncestor = ancestor.parentNode
      unwrapElement(ancestor)
      ancestor = nextAncestor
      continue
    }

    currentNode = ancestor
    ancestor = ancestor.parentNode
  }

  return node
}

const applyInlineStyleToSelection = (styleKey, styleValue, clearKeys = [styleKey]) => {
  if (props.disabled || typeof document === 'undefined') return
  const range = getActiveRange()
  if (!range) return
  if (range.collapsed) {
    message.warning('请先选中要设置样式的文字')
    return
  }

  ensureEditorFocus()
  try {
    const fragment = range.extractContents()
    clearStyleOnFragment(fragment, clearKeys)
    const wrapper = document.createElement('span')
    wrapper.style.setProperty(styleKey, styleValue)
    wrapper.appendChild(fragment)
    range.insertNode(wrapper)
    normalizeStyledAncestors(wrapper, clearKeys)
    range.selectNodeContents(wrapper)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedRange.value = range.cloneRange()
    syncContent()
    saveSelectionRange()
    syncToolbarStateFromSelection()
  } catch (error) {
    console.error('Failed to apply inline style', error)
  }
}

const handleHeadingChange = (value) => {
  if (props.disabled) return
  ensureEditorFocus()
  restoreSelectionRange()
  if (value === 'paragraph') {
    document.execCommand('formatBlock', false, 'P')
  } else {
    document.execCommand('formatBlock', false, value.toUpperCase())
  }
  nextTick(() => {
    headingValue.value = value
    syncContent()
    saveSelectionRange()
    syncToolbarStateFromSelection()
  })
}

const handleCreateLink = () => {
  if (props.disabled) return
  restoreSelectionRange()
  const selection = window.getSelection()
  if (!selection || selection.toString().trim().length === 0) {
    message.warning('请先选择需要添加链接的文本')
    return
  }
  const url = window.prompt('请输入链接地址', 'https://')
  if (!url) return
  applyCommand('createLink', url)
}

const handleRemoveLink = () => {
  if (props.disabled) return
  applyCommand('unlink')
}

const applyTextColor = (color) => {
  const normalized = normalizeHexColor(color)
  if (props.disabled || !normalized) return
  selectedTextColor.value = normalized
  colorHexInput.value = normalized
  applyInlineStyleToSelection('color', normalized, ['color'])
}

const applyHexInputColor = () => {
  const normalized = normalizeHexColor(colorHexInput.value)
  if (!normalized) {
    message.warning('请输入有效的十六进制颜色，例如 #1677ff')
    return
  }
  applyTextColor(normalized)
}

const openColorPicker = () => {
  if (props.disabled) return
  saveSelectionRange()
  colorInputRef.value?.click()
}

const handleColorInput = (event) => {
  const normalized = normalizeHexColor(event?.target?.value)
  if (!normalized) return
  applyTextColor(normalized)
}

const applyFontSize = (size) => {
  const normalized = normalizeFontSize(size)
  if (props.disabled || !normalized) return
  fontSizeValue.value = normalized
  applyInlineStyleToSelection('font-size', normalized, ['font-size'])
}

const handleFontSizeMouseDown = (event, size) => {
  event.preventDefault()
  applyFontSize(size)
}

const insertImageFromFile = async (file) => {
  if (!file) return
  if (file.size > MAX_IMAGE_SIZE) {
    message.warning('图片限制大小 5MB')
    return
  }

  try {
    const { url } = await uploadPublicFile(file)
    if (!url) throw new Error('Missing image url')
    ensureEditorFocus()
    restoreSelectionRange()
    document.execCommand('insertImage', false, url)
    syncContent()
    saveSelectionRange()
  } catch (error) {
    console.error('Failed to upload image', error)
    message.error('上传图片失败，请稍后重试')
  }
}

const handleSelectImage = () => {
  if (props.disabled) return
  imageInputRef.value?.click()
}

const handleImageChange = async (event) => {
  if (props.disabled) return
  const input = event?.target
  const file = input?.files?.[0]
  if (!file) return
  await insertImageFromFile(file)
  input.value = ''
}

const handlePaste = async (event) => {
  if (props.disabled) return
  const clipboard = event.clipboardData
  if (!clipboard) return
  const files = Array.from(clipboard.files || []).filter((file) =>
    file?.type?.toLowerCase().startsWith('image/'),
  )
  if (!files.length) return

  event.preventDefault()
  for (const file of files) {
    await insertImageFromFile(file)
  }
}

const toolbarButtons = [
  { key: 'bold', icon: BoldOutlined, command: () => applyCommand('bold'), label: '加粗' },
  { key: 'italic', icon: ItalicOutlined, command: () => applyCommand('italic'), label: '斜体' },
  { key: 'underline', icon: UnderlineOutlined, command: () => applyCommand('underline'), label: '下划线' },
  { key: 'strike', icon: StrikethroughOutlined, command: () => applyCommand('strikeThrough'), label: '删除线' },
  { key: 'ordered', icon: OrderedListOutlined, command: () => applyCommand('insertOrderedList'), label: '有序列表' },
  { key: 'unordered', icon: UnorderedListOutlined, command: () => applyCommand('insertUnorderedList'), label: '无序列表' },
  { key: 'align-left', icon: AlignLeftOutlined, command: () => applyCommand('justifyLeft'), label: '左对齐' },
  { key: 'align-center', icon: AlignCenterOutlined, command: () => applyCommand('justifyCenter'), label: '居中对齐' },
  { key: 'align-right', icon: AlignRightOutlined, command: () => applyCommand('justifyRight'), label: '右对齐' },
  { key: 'link', icon: LinkOutlined, command: handleCreateLink, label: '添加链接' },
  { key: 'unlink', icon: ClearOutlined, command: handleRemoveLink, label: '移除链接' },
  { key: 'image', icon: PictureOutlined, isUpload: true, command: handleSelectImage, label: '插入图片' },
]

onMounted(() => {
  if (editorRef.value) {
    editorRef.value.innerHTML = editorContent.value
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('selectionchange', syncToolbarStateFromSelection)
  }
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('selectionchange', syncToolbarStateFromSelection)
  }
})
</script>

<template>
  <div class="open-platform-editor" :class="{ 'is-disabled': disabled }">
    <div class="open-platform-editor__toolbar">
      <a-select
        v-model:value="headingValue"
        class="open-platform-editor__heading"
        size="small"
        :disabled="disabled"
        :get-popup-container="getPopupContainer"
        @change="handleHeadingChange"
      >
        <a-select-option value="paragraph">正文</a-select-option>
        <a-select-option value="h1">标题一</a-select-option>
        <a-select-option value="h2">标题二</a-select-option>
        <a-select-option value="h3">标题三</a-select-option>
      </a-select>
      <a-popover trigger="click" placement="bottom">
        <template #content>
          <div class="open-platform-editor__size-panel" @mousedown.prevent>
            <button
              v-for="size in FONT_SIZE_OPTIONS"
              :key="size"
              type="button"
              class="open-platform-editor__size-option"
              :class="{ 'is-active': fontSizeValue === size }"
              @mousedown="(event) => handleFontSizeMouseDown(event, size)"
            >
              {{ size }}
            </button>
          </div>
        </template>
        <a-button type="default" size="small" class="open-platform-editor__font-size-button" :disabled="disabled" @mousedown.prevent>
          {{ fontSizeValue }}
        </a-button>
      </a-popover>
      <div class="open-platform-editor__actions">
        <a-popover trigger="click" placement="bottom">
          <template #content>
            <div class="open-platform-editor__color-panel" @mousedown.prevent>
              <button
                v-for="color in TEXT_COLOR_PRESETS"
                :key="color"
                type="button"
                class="open-platform-editor__color-swatch"
                :class="{ 'is-active': selectedTextColor === color }"
                :style="{ backgroundColor: color }"
                @mousedown.prevent="applyTextColor(color)"
              ></button>
              <div class="open-platform-editor__hex-row">
                <a-input
                  v-model:value="colorHexInput"
                  size="small"
                  class="open-platform-editor__hex-input"
                  placeholder="#1677ff"
                  @focus="saveSelectionRange"
                  @pressEnter="applyHexInputColor"
                />
                <a-button size="small" type="primary" @mousedown.prevent @click="applyHexInputColor">应用</a-button>
                <a-button size="small" @mousedown.prevent @click="openColorPicker">自定义</a-button>
              </div>
            </div>
          </template>
          <a-tooltip title="文字颜色">
            <a-button type="text" size="small" :disabled="disabled" @mousedown.prevent>
              <span class="open-platform-editor__color-indicator" :style="{ color: selectedTextColor }">A</span>
            </a-button>
          </a-tooltip>
        </a-popover>
        <a-tooltip v-for="button in toolbarButtons" :key="button.key" :title="button.label">
          <a-button v-if="button.isUpload" type="text" size="small" :disabled="disabled" @click="button.command">
            <component :is="button.icon" />
          </a-button>
          <a-button v-else type="text" size="small" :disabled="disabled" @mousedown.prevent @click.prevent="button.command">
            <component :is="button.icon" />
          </a-button>
        </a-tooltip>
      </div>
    </div>
    <input ref="imageInputRef" type="file" accept="image/*" class="open-platform-editor__file-input" @change="handleImageChange" />
    <input ref="colorInputRef" type="color" class="open-platform-editor__color-input" :value="selectedTextColor" @input="handleColorInput" />
    <div class="open-platform-editor__content-wrapper">
      <div
        ref="editorRef"
        class="open-platform-editor__content"
        :contenteditable="!disabled"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keyup="syncToolbarStateFromSelection"
        @mouseup="syncToolbarStateFromSelection"
        @paste="handlePaste"
      ></div>
      <div v-if="!hasContent && !isFocused && placeholder" class="open-platform-editor__placeholder">
        {{ placeholder }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.open-platform-editor {
  position: relative;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  background-color: #fff;
}

.open-platform-editor.is-disabled {
  background-color: #f5f5f5;
}

.open-platform-editor__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #d9d9d9;
  background-color: #fafafa;
  flex-wrap: wrap;
}

.open-platform-editor__heading {
  width: 120px;
}

.open-platform-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.open-platform-editor__font-size-button {
  min-width: 72px;
}

.open-platform-editor__size-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  min-width: 180px;
}

.open-platform-editor__size-option {
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  padding: 6px 8px;
  font-size: 12px;
  cursor: pointer;
}

.open-platform-editor__size-option.is-active {
  border-color: #1677ff;
  color: #1677ff;
  background: #e6f4ff;
}

.open-platform-editor__actions .ant-btn-text {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
}

.open-platform-editor__color-panel {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  max-width: 280px;
}

.open-platform-editor__color-swatch {
  width: 20px;
  height: 20px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 999px;
  cursor: pointer;
  padding: 0;
}

.open-platform-editor__color-swatch.is-active {
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.2);
}

.open-platform-editor__hex-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  flex-wrap: wrap;
}

.open-platform-editor__hex-input {
  flex: 1 1 auto;
  min-width: 120px;
}

.open-platform-editor__color-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

.open-platform-editor__content-wrapper {
  position: relative;
}

.open-platform-editor__content {
  position: relative;
  min-height: 240px;
  padding: 16px 20px;
  font-size: 14px;
  line-height: 1.6;
  outline: none;
  overflow-y: auto;
}

.open-platform-editor__content img {
  max-width: 100%;
  height: auto;
}

.open-platform-editor__file-input {
  display: none;
}

.open-platform-editor__color-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.open-platform-editor__placeholder {
  position: absolute;
  left: 20px;
  top: 16px;
  color: #bfbfbf;
  pointer-events: none;
  font-size: 14px;
}

.open-platform-editor.is-disabled .open-platform-editor__content {
  cursor: not-allowed;
}
</style>
