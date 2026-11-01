<script setup>
import { adminTheme } from './theme/adminAppearance'
</script>

<template>
  <a-config-provider :theme="adminTheme">
    <router-view />
  </a-config-provider>
</template>
