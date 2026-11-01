<script setup>
import { onMounted, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { adminThemes } from '../theme/adminThemes';
import { savedAdminSkin, appearanceLoaded, appearanceLoading, appearanceSaving, appearanceError, loadAdminAppearance, saveAdminAppearance } from '../theme/adminAppearance';

const selected = ref(savedAdminSkin.value);
watch(savedAdminSkin, value => { selected.value = value; });
onMounted(() => { if (!appearanceLoaded.value) loadAdminAppearance(); });
async function save() {
  try { await saveAdminAppearance(selected.value); message.success('皮肤已保存到当前管理员账号'); }
  catch (error) { message.error(error.response?.data?.message?.zh || error.message || '保存失败，请重试'); }
}
</script>

<template>
  <section class="appearance-settings" aria-labelledby="appearance-title" :aria-busy="appearanceLoading || appearanceSaving">
    <header>
      <h3 id="appearance-title">管理端皮肤</h3>
      <p>选择喜欢的配色，保存后立即应用。设置跟随当前管理员账号，换设备登录也会恢复。</p>
    </header>
    <a-alert v-if="appearanceError" :message="appearanceError" type="error" show-icon>
      <template #action><a-button size="small" :loading="appearanceLoading" @click="loadAdminAppearance">重新读取</a-button></template>
    </a-alert>
    <fieldset class="skin-options" :disabled="!appearanceLoaded || appearanceLoading || appearanceSaving">
      <legend class="skin-legend">选择皮肤</legend>
      <label v-for="skin in adminThemes" :key="skin.id" class="skin-option" :class="{ selected: selected === skin.id }">
        <input v-model="selected" type="radio" name="admin-skin" :value="skin.id" :aria-label="skin.name" />
        <span class="skin-preview" aria-hidden="true" :style="{ '--preview-bg': skin.colors.bg, '--preview-surface': skin.colors.surface, '--preview-accent': skin.colors.lime, '--preview-line': skin.colors.line, '--preview-text': skin.colors.muted }">
          <span class="preview-sidebar"><i></i><i></i><i></i></span>
          <span class="preview-content"><i class="preview-title"></i><span class="preview-panels"><i></i><i></i></span><i class="preview-button"></i></span>
        </span>
        <span class="skin-heading"><strong>{{ skin.name }}</strong><span v-if="savedAdminSkin === skin.id" class="skin-current">使用中</span></span>
        <span class="skin-description">{{ skin.description }}</span>
      </label>
    </fieldset>
    <div class="appearance-actions">
      <a-button type="primary" :loading="appearanceSaving" :disabled="!appearanceLoaded || appearanceLoading || selected === savedAdminSkin" @click="save">保存皮肤</a-button>
      <span role="status">{{ appearanceLoading ? '正在读取账号设置…' : selected !== savedAdminSkin ? '有未保存的皮肤选择' : '当前皮肤：' + (adminThemes.find(skin => skin.id === savedAdminSkin)?.name || '青柠夜航') }}</span>
    </div>
  </section>
</template>

<style scoped>
.appearance-settings { max-width: 1120px; padding: 8px 0 20px; }
header h3 { font-size: 22px; margin: 0 0 8px; }
header p, .skin-description, .appearance-actions > span { color: var(--admin-muted); font-size: 13px; }
header p { margin: 0 0 24px; }
.skin-options { margin: 20px 0 24px; border: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 16px; min-width: 0; }
.skin-legend { font-size: 14px; margin-bottom: 12px; color: var(--admin-text); }
.skin-option { position: relative; display: flex; flex-direction: column; gap: 12px; padding: 14px; border: 1px solid var(--admin-border); background: var(--admin-bg); border-radius: 12px; cursor: pointer; min-width: 0; }
.skin-option.selected { border-color: var(--admin-lime); box-shadow: 0 0 0 1px var(--admin-lime); }
.skin-option:focus-within { outline: 2px solid var(--admin-lime); outline-offset: 4px; }
.skin-option input { position: absolute; right: 20px; top: 20px; width: 18px; height: 18px; accent-color: var(--admin-lime); z-index: 1; }
.skin-options:disabled .skin-option { cursor: wait; opacity: .65; }
.skin-preview { display: flex; height: 114px; overflow: hidden; border: 1px solid var(--preview-line); border-radius: 7px; background: var(--preview-bg); }
.preview-sidebar { width: 24%; background: var(--preview-surface); border-right: 1px solid var(--preview-line); padding: 18px 9px; display: flex; flex-direction: column; gap: 10px; }
.preview-sidebar i { height: 5px; border-radius: 2px; background: var(--preview-text); opacity: .5; }
.preview-sidebar i:first-child { background: var(--preview-accent); opacity: 1; }
.preview-content { flex: 1; padding: 21px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
.preview-title { height: 5px; width: 48%; background: var(--preview-text); border-radius: 2px; }
.preview-panels { display: flex; gap: 8px; flex: 1; }
.preview-panels i { flex: 1; background: var(--preview-surface); border: 1px solid var(--preview-line); border-radius: 4px; }
.preview-button { height: 8px; width: 34%; border-radius: 3px; background: var(--preview-accent); }
.skin-heading { display: flex; align-items: center; gap: 10px; justify-content: space-between; color: var(--admin-text); }
.skin-heading strong { font-size: 15px; }
.skin-current { font-size: 11px; color: var(--admin-lime); }
.skin-description { line-height: 1.7; }
.appearance-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
@media (max-width: 600px) { .skin-options { grid-template-columns: minmax(0, 1fr); } }
</style>
