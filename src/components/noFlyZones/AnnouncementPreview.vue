<script setup>
import { computed } from 'vue'
import { cleanAnnouncementHtml, publicAnnouncementUrl } from '../../utils/noFlyAnnouncement'
const props = defineProps({ announcement: Object, fallbackTitle: String })
const content = computed(() => cleanAnnouncementHtml(props.announcement?.content, true))
</script>
<template>
  <article class="announcement-paper">
    <div class="announcement-kicker">低空星球 · 临时空域公告</div>
    <h1>{{ announcement?.title || fallbackTitle || '临时禁飞公告' }}</h1>
    <p class="announcement-meta">{{ announcement?.publisher }}<span v-if="announcement?.publishedAt"> · {{ announcement.publishedAt }}</span></p>
    <div class="announcement-body" v-html="content" />
    <section v-if="announcement?.attachments?.length" class="announcement-files">
      <h2>公告附件</h2>
      <a v-for="file in announcement.attachments" :key="file.url" :href="publicAnnouncementUrl(file.url)" target="_blank" rel="noopener noreferrer">{{ file.name || '下载附件' }} ↗</a>
    </section>
    <footer v-if="publicAnnouncementUrl(announcement?.sourceUrl)"><span>信息来源</span><a :href="publicAnnouncementUrl(announcement.sourceUrl)" target="_blank" rel="noopener noreferrer">阅读原文 ↗</a></footer>
  </article>
</template>
<style scoped>
.announcement-paper{max-width:760px;margin:0 auto;padding:28px;background:#fff;color:#172b43;border:1px solid #e3eaf2;border-radius:16px;overflow-wrap:anywhere}
.announcement-kicker{font-size:12px;letter-spacing:2px;color:#51708e;border-left:3px solid #1677ff;padding-left:10px}
h1{font-size:24px;line-height:1.5;margin:20px 0 12px}.announcement-meta{color:#738499;font-size:13px;padding-bottom:18px;border-bottom:1px solid #e9eef4}
.announcement-body{font-size:16px;line-height:1.9}.announcement-body :deep(img){max-width:100%;height:auto;display:block;border-radius:8px;margin:18px auto}
.announcement-body :deep(h2){font-size:19px;margin-top:26px}.announcement-body :deep(table){border-collapse:collapse;max-width:100%}.announcement-body :deep(td),.announcement-body :deep(th){border:1px solid #e3eaf2;padding:8px}
.announcement-files{background:#f5f8fc;padding:16px;border-radius:10px;margin-top:24px}.announcement-files h2{font-size:16px;margin:0 0 12px}.announcement-files a{display:block;margin:10px 0}
footer{display:flex;justify-content:space-between;gap:16px;border-top:1px solid #e9eef4;padding-top:18px;margin-top:28px;font-size:14px;color:#738499}
@media(max-width:600px){.announcement-paper{padding:18px}h1{font-size:21px}}
</style>
