<script setup>
import { ref, watch } from 'vue'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import { message } from 'ant-design-vue'

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

const editorContent = ref(props.modelValue || '')
const editorRef = ref(null)

watch(
  () => props.modelValue,
  (value) => {
    if (value !== editorContent.value) {
      editorContent.value = value || ''
    }
  },
)

watch(editorContent, (value) => {
  emit('update:modelValue', value || '')
})

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

    if (file.size > 5 * 1024 * 1024) {
      message.warning('图片大小不能超过 5MB')
      return
    }

    try {
      const { url } = await uploadPublicFile(file)
      if (!url) {
        throw new Error('Missing image url')
      }

      const quill = editorRef.value?.getQuill?.()
      if (!quill) return

      const range = quill.getSelection(true)
      const index = range ? range.index : quill.getLength()
      quill.insertEmbed(index, 'image', url, 'user')
      quill.setSelection(index + 1)
    } catch (error) {
      console.error('Failed to upload image', error)
      message.error('图片上传失败，请稍后重试')
    }
  }
}

const modules = {
  toolbar: {
    container: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ header: 1 }, { header: 2 }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ indent: '-1' }, { indent: '+1' }],
      [{ align: [] }],
      [{ color: [] }, { background: [] }],
      ['link', 'image'],
      ['clean'],
    ],
    handlers: {
      image: handleSelectImage,
    },
  },
}
</script>

<template>
  <div class="open-platform-editor">
    <QuillEditor
      ref="editorRef"
      v-model:content="editorContent"
      class="open-platform-editor__quill"
      :read-only="disabled"
      :modules="modules"
      content-type="html"
      theme="snow"
      :placeholder="placeholder"
    />
  </div>
</template>

<style scoped>
.open-platform-editor {
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  overflow: hidden;
}

.open-platform-editor__quill {
  min-height: 280px;
}

.open-platform-editor :deep(.ql-toolbar) {
  border: none;
  border-bottom: 1px solid #d9d9d9;
  background: #fafafa;
}

.open-platform-editor :deep(.ql-container) {
  border: none;
  min-height: 240px;
  font-size: 14px;
}
</style>
