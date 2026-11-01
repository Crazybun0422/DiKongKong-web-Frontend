<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { fetchTownConfig, uploadTownKml } from '../services/townRegions'
const current = ref(null), version = ref(''), crs = ref('GCJ02'), file = ref(null), busy = ref(false), progress = ref(0)
const reload = async () => { try { current.value = await fetchTownConfig() } catch (e) { if (e.response?.status !== 404) message.error(e.message) } }
const submit = async () => {
  if (!file.value || !version.value.trim()) return message.warning('请选择镇级 KML 压缩包并填写版本')
  busy.value = true; progress.value = 0
  try {
    current.value = await uploadTownKml(file.value, version.value.trim(), crs.value, e => { progress.value = Math.round((e.loaded / (e.total || file.value.size)) * 100) })
    message.success(`镇级范围已更新，共 ${current.value.townCount} 个镇`)
  } catch (e) { message.error(e.response?.data?.message?.zh || e.message || '上传失败') }
  finally { busy.value = false }
}
onMounted(reload)
</script>
<template>
  <section style="max-width: 680px">
    <h3>上传镇级 KML 范围</h3>
    <p>上传包含省 / 市 / 县 / 镇目录或对应属性的 KML ZIP。服务器拆分后，客户端按选择的镇下载。</p>
    <p v-if="current">当前版本：{{ current.version }} · {{ current.townCount }} 个镇</p>
    <a-form layout="vertical" :model="{ version, crs }" @finish="submit">
      <a-form-item label="镇级 KML ZIP"><input type="file" accept=".zip" :disabled="busy" @change="file = $event.target.files[0] || null" /></a-form-item>
      <a-form-item label="版本"><a-input v-model:value="version" :disabled="busy" :maxlength="80" placeholder="例如 2026.10.02" /></a-form-item>
      <a-form-item label="压缩包坐标系"><a-select v-model:value="crs" :disabled="busy" :options="[{value:'GCJ02',label:'GCJ-02（已转换的镇级包）'},{value:'WGS84',label:'WGS84（服务器转换一次）'}]" /></a-form-item>
      <a-progress v-if="busy" :percent="progress" :status="'active'" />
      <p v-if="busy && progress === 100">上传完成，服务器正在拆分并校验范围，请勿关闭页面。</p>
      <a-button type="primary" html-type="submit" :loading="busy">上传并发布</a-button>
    </a-form>
  </section>
</template>
