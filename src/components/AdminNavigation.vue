<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { SearchOutlined, ArrowUpOutlined } from '@ant-design/icons-vue'
const props = defineProps({ items: { type: Array, required: true } })
const emit = defineEmits(['navigate'])
const route = useRoute()
const query = ref('')
const groups = computed(() => ['工作空间', '用户与运营', '平台管理'].map(label => ({
  label,
  items: props.items.filter(item => item.group === label && item.label.toLowerCase().includes(query.value.trim().toLowerCase())),
})).filter(group => group.items.length))
</script>

<template>
  <div class="admin-navigation">
    <a-input v-model:value="query" class="nav-search" placeholder="搜索菜单" aria-label="搜索管理菜单" allow-clear>
      <template #prefix><SearchOutlined /></template>
    </a-input>
    <nav aria-label="管理端导航">
      <section v-for="group in groups" :key="group.label" class="nav-group">
        <p class="nav-group-label">{{ group.label }}</p>
        <router-link v-for="item in group.items" :key="item.key" :to="item.path"
          :class="['admin-nav-link', { active: route.name === item.key }]"
          :aria-current="route.name === item.key ? 'page' : undefined" @click="emit('navigate')">
          <component :is="item.icon" aria-hidden="true" /><span>{{ item.label }}</span>
          <span v-if="route.name === item.key" class="active-dot" aria-hidden="true"></span>
        </router-link>
      </section>
      <p v-if="!groups.length" class="nav-empty" role="status">没有匹配的菜单</p>
    </nav>
    <a class="nav-home-link" href="/">访问低空星球官网 <ArrowUpOutlined :rotate="45" /></a>
  </div>
</template>

<style scoped>
.admin-navigation { display: flex; flex-direction: column; min-height: 100%; gap: 24px; }
.nav-search { background: var(--admin-bg); }
nav { flex: 1; }
.nav-group + .nav-group { margin-top: 24px; }
.nav-group-label { margin: 0 12px 10px; color: var(--admin-muted); font-size: 11px; letter-spacing: 2px; }
.admin-nav-link { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 10px 12px; margin: 4px 0; border-radius: 8px; color: var(--admin-muted); font-size: 13px; transition: background .2s, color .2s; }
.admin-nav-link > .anticon { font-size: 17px; }
.admin-nav-link:hover { color: var(--admin-text); background: var(--admin-raised); }
.admin-nav-link.active { color: var(--admin-lime); background: var(--admin-accent-soft); }
.active-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--admin-lime); margin-left: auto; }
.nav-home-link { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--admin-line); padding: 20px 12px 4px; color: var(--admin-muted); font-size: 12px; }
.nav-empty { padding: 12px; color: var(--admin-muted); }
</style>
