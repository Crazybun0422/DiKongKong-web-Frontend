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
const editorContent = ref(props.modelValue || '')
const isFocused = ref(false)
const headingValue = ref('paragraph')
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

const hasContent = computed(() => {
  const html = editorContent.value || ''
  if (/<(img|video|iframe|object|embed)/i.test(html)) {
    return true
  }
  const text = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()
  return text.length > 0
})

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

const detectHeadingFromSelection = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !editorRef.value) {
    headingValue.value = 'paragraph'
    return
  }
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    headingValue.value = 'paragraph'
    return
  }
  const range = selection.getRangeAt(0)
  let node = range.startContainer
  while (node && node !== editorRef.value) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.nodeName
      if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
        headingValue.value = tag.toLowerCase()
        return
      }
    }
    node = node.parentNode
  }
  headingValue.value = 'paragraph'
}

const handleInput = () => {
  syncContent()
  detectHeadingFromSelection()
}

const handleFocus = () => {
  isFocused.value = true
  detectHeadingFromSelection()
}

const handleBlur = () => {
  isFocused.value = false
  syncContent()
}

const applyCommand = (command, value = null) => {
  if (props.disabled || typeof document === 'undefined') return
  ensureEditorFocus()
  document.execCommand(command, false, value)
  syncContent()
}

const handleHeadingChange = (value) => {
  if (props.disabled) return
  ensureEditorFocus()
  if (value === 'paragraph') {
    document.execCommand('formatBlock', false, 'P')
  } else {
    document.execCommand('formatBlock', false, value.toUpperCase())
  }
  nextTick(() => {
    headingValue.value = value
    syncContent()
    detectHeadingFromSelection()
  })
}

const handleCreateLink = () => {
  if (props.disabled) return
  const selection = window.getSelection()
  if (!selection || selection.toString().trim().length === 0) {
    message.warning('请先选择需要添加链接的文本')
    return
  }
  const url = window.prompt('请输入链接地址', 'https://')
  if (!url) {
    return
  }
  applyCommand('createLink', url)
}

const handleRemoveLink = () => {
  if (props.disabled) return
  applyCommand('unlink')
}

const insertImageFromFile = async (file) => {
  if (!file) return
  if (file.size > MAX_IMAGE_SIZE) {
    message.warning('图片限制大小： 5MB')
    return
  }

  try {
    const { url } = await uploadPublicFile(file)
    if (!url) {
      throw new Error('Missing image url')
    }

    ensureEditorFocus()
    document.execCommand('insertImage', false, url)
    syncContent()
  } catch (error) {
    console.error('Failed to upload image', error)
    message.error('上传图片失败，请稍后重试')
  }
}

const handleSelectImage = () => {
  if (props.disabled) {
    return
  }

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.click()

  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) {
      return
    }
    await insertImageFromFile(file)
  }
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
  { key: 'image', icon: PictureOutlined, command: handleSelectImage, label: '插入图片' },
]

onMounted(() => {
  if (editorRef.value) {
    editorRef.value.innerHTML = editorContent.value
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('selectionchange', detectHeadingFromSelection)
  }
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('selectionchange', detectHeadingFromSelection)
  }
})
</script>

<template>
  <div class="open-platform-editor" :class="{ 'is-disabled': disabled }">
    <div class="open-platform-editor__toolbar">
      <a-select v-model:value="headingValue" class="open-platform-editor__heading" size="small" :disabled="disabled"
        @change="handleHeadingChange">
        <a-select-option value="paragraph">正文</a-select-option>
        <a-select-option value="h1">标题一</a-select-option>
        <a-select-option value="h2">标题二</a-select-option>
        <a-select-option value="h3">标题三</a-select-option>
      </a-select>
      <div class="open-platform-editor__actions">
        <a-tooltip v-for="button in toolbarButtons" :key="button.key" :title="button.label">
          <a-button type="text" size="small" :disabled="disabled" @mousedown.prevent @click.prevent="button.command">
            <component :is="button.icon" />
          </a-button>
        </a-tooltip>
      </div>
    </div>
    <div class="open-platform-editor__content-wrapper">
      <div ref="editorRef" class="open-platform-editor__content" :contenteditable="!disabled" @input="handleInput"
        @focus="handleFocus" @blur="handleBlur" @keyup="detectHeadingFromSelection"
        @mouseup="detectHeadingFromSelection" @paste="handlePaste"></div>
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
}

.open-platform-editor__heading {
  width: 120px;
}

.open-platform-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.open-platform-editor__actions .ant-btn-text {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
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
