<script setup>
import { ref } from 'vue'
import AdminAuthPanel from '../components/AdminAuthPanel.vue'
import brandLogo from '../landing/assets/logo.png'
import planetImage from '../landing/assets/orbit-and-map-fallback-v4.webp'
import planetVideo from '../landing/assets/orbit-and-map-v4.mp4'

const planetPlaying = ref(false)
</script>

<template>
  <div class="auth-page">
    <header class="auth-header">
      <a class="auth-brand" href="/"><img :src="brandLogo" alt="低空星球" /><span>低空星球</span></a>
      <a class="back-home" href="/">返回官网 <span aria-hidden="true">↗</span></a>
    </header>
    <main class="auth-main">
      <div class="auth-planet" aria-hidden="true">
        <img :src="planetImage" alt="" :class="{ 'is-playing': planetPlaying }" />
        <video :src="planetVideo" autoplay muted loop playsinline preload="auto" disablepictureinpicture
          :class="{ 'is-playing': planetPlaying }" @playing="planetPlaying = true" @error="planetPlaying = false" />
      </div>
      <section class="auth-story" aria-labelledby="auth-title">
        <span class="auth-eyebrow">LOW ALTITUDE PLANET / ADMIN</span>
        <h1 id="auth-title">让飞行，<br /><span>连接更多可能。</span></h1>
        <p>连接每一份热爱，<br />用心管理星球的每一天。</p>
      </section>
      <section class="auth-entry" aria-labelledby="entry-title">
        <span class="entry-badge"><i aria-hidden="true"></i> 星球管理中心</span>
        <h2 id="entry-title">欢迎回来</h2>
        <p class="entry-description">登录管理账户，开始今天的工作。</p>
        <AdminAuthPanel />
        <p class="auth-note">探索天空，也照顾好每一位飞行伙伴。</p>
      </section>
    </main>
    <footer class="auth-footer"><span>低空星球 · 管理中心</span><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">苏ICP备2025183953号-2</a></footer>
  </div>
</template>

<style scoped>
.auth-page { overflow-x: clip; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; width: min(1280px, calc(100% - 96px)); margin: auto; }
.auth-header { min-height: 98px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--admin-line); gap: 16px; }
.auth-brand { display: flex; align-items: center; gap: 13px; color: var(--admin-text); font-size: 23px; font-weight: 650; letter-spacing: 2px; }
.auth-brand img { width: 48px; height: 48px; border-radius: 50%; }
.back-home { color: var(--admin-muted); display: flex; gap: 16px; align-items: center; min-height: 44px; font-size: 13px; }
.back-home span { color: var(--admin-lime); font-size: 22px; }
.auth-main { position: relative; isolation: isolate; flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) 420px; align-items: center; gap: 8%; padding: 64px 0; }
.auth-story { position: relative; min-height: 490px; isolation: isolate; }
.auth-eyebrow { color: var(--admin-muted); font-size: 11px; letter-spacing: 3px; }
.auth-story h1 { font-size: clamp(40px, 4vw, 60px); line-height: 1.3; font-weight: 600; letter-spacing: -2px; margin: 26px 0 20px; }
.auth-story h1 span { color: var(--admin-lime); }
.auth-story p { font-size: 18px; line-height: 1.9; color: var(--admin-muted); }
.auth-planet { position: absolute; z-index: -1; width: 1040px; max-width: none; aspect-ratio: 4 / 3; left: 50%; top: 50%; transform: translate(-50%, -50%); opacity: .75; pointer-events: none; mask-image: radial-gradient(ellipse, black 40%, transparent 73%); }
.auth-planet img, .auth-planet video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.auth-planet video { opacity: 0; }
.auth-planet video.is-playing { opacity: 1; }
.auth-planet img.is-playing { visibility: hidden; }
.auth-entry { background: var(--admin-surface); border: 1px solid var(--admin-border); border-radius: 16px; padding: 34px; }
.entry-badge { color: var(--admin-muted); font-size: 12px; display: flex; align-items: center; gap: 8px; }
.entry-badge i { width: 6px; height: 6px; border-radius: 50%; background: var(--admin-lime); }
.auth-entry h2 { font-size: 30px; font-weight: 550; margin: 26px 0 10px; }
.entry-description { color: var(--admin-muted); font-size: 13px; margin-bottom: 24px; }
.auth-note { color: var(--admin-muted); font-size: 11px; margin: 24px 0 0; padding-top: 20px; border-top: 1px solid var(--admin-line); }
.auth-footer { border-top: 1px solid var(--admin-line); display: flex; justify-content: space-between; gap: 12px; padding: 24px 0; color: var(--admin-muted); font-size: 12px; }
.auth-footer a { color: inherit; }
@media (max-width: 960px) { .auth-page { width: calc(100% - 48px); } .auth-main { gap: 32px; grid-template-columns: minmax(0,1fr) 380px; } .auth-story h1 { font-size: 40px; } }
@media (max-width: 720px) { .auth-page { width: calc(100% - 32px); } .auth-header { min-height: 76px; } .auth-brand { font-size: 18px; gap: 10px; } .auth-brand img { width: 40px; height: 40px; } .auth-main { grid-template-columns: minmax(0,1fr); gap: 28px; padding: 32px 0; } .auth-story { min-height: 0; } .auth-eyebrow { font-size: 9px; letter-spacing: 2px; } .auth-story h1 { font-size: 34px; margin: 16px 0 0; } .auth-story p, .auth-planet { display: none; } .auth-entry { padding: 24px; width: 100%; max-width: 460px; justify-self: center; } .auth-entry h2 { font-size: 26px; margin-top: 20px; } .auth-footer { flex-wrap: wrap; font-size: 11px; } }
</style>
