<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons-vue'
import CaptchaDialog from './CaptchaDialog.vue'
import http, { setAuthToken } from '../services/http'

const router = useRouter()
const { t } = useI18n()

const activeTabKey = ref('login')

const loginFormRef = ref()
const registerFormRef = ref()

const loginForm = reactive({
  username: '',
  password: '',
})

const registerForm = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  email: '',
})

const loginLoading = ref(false)
const registerLoading = ref(false)
const captchaVisible = ref(false)
const pendingLogin = reactive({
  username: '',
  password: '',
})

const loginRules = computed(() => ({
  username: [{ required: true, message: t('auth.enterAdminAccount'), trigger: 'blur' }],
  password: [{ required: true, message: t('auth.enterPassword'), trigger: 'blur' }],
}))

const validateConfirmPassword = (_rule, value) => {
  if (!value) {
    return Promise.reject(t('auth.enterPasswordAgain'))
  }
  if (value !== registerForm.password) {
    return Promise.reject(t('auth.passwordMismatch'))
  }
  return Promise.resolve()
}

const registerRules = computed(() => ({
  username: [{ required: true, message: t('auth.enterAdminAccount'), trigger: 'blur' }],
  password: [{ required: true, message: t('auth.enterPassword'), trigger: 'blur' }],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: 'blur' }],
  email: [
    { required: true, message: t('auth.enterEmail'), trigger: 'blur' },
    { type: 'email', message: t('auth.invalidEmail'), trigger: ['blur', 'change'] },
  ],
}))

const extractErrorMessage = (error) => {
  const fallback = t('messages.requestFailed')
  const data = error?.response?.data
  if (!data) {
    return error?.message || fallback
  }
  if (typeof data === 'string') {
    return data
  }
  if (data.msg) {
    return data.msg
  }
  if (typeof data.message === 'string') {
    return data.message
  }
  if (data.message && typeof data.message === 'object') {
    return Object.values(data.message).join('、')
  }
  return fallback
}

const clearLoginForm = () => {
  loginForm.password = ''
}

const clearRegisterForm = () => {
  registerForm.username = ''
  registerForm.password = ''
  registerForm.confirmPassword = ''
  registerForm.email = ''
}

const applyLoginSuccess = (responseData) => {
  const payload = responseData?.data || responseData
  const token = payload?.token
  const loginSeq = payload?.loginSeq
  const username =
    payload?.username || loginForm.username || pendingLogin.username || t('profile.menu')

  if (token) {
    setAuthToken(token)
  }
  if (username) {
    localStorage.setItem('admin_username', username)
  }
  if (loginSeq) {
    localStorage.setItem('admin_login_seq', loginSeq)
  }
  message.success(t('auth.loginSuccess'))
  clearLoginForm()
  router.push({ name: 'home' }).catch(() => {})
}

const shouldTriggerCaptcha = (msg = '') =>
  /captcha/i.test(msg) ||
  /验证/.test(msg) ||
  msg.includes('请完成滑动验证') ||
  msg.includes('Please complete the captcha first')

const handleLogin = async () => {
  loginLoading.value = true
  try {
    const { data } = await http.post('/auth/login', {
      username: loginForm.username,
      password: loginForm.password,
    })
    applyLoginSuccess(data)
  } catch (error) {
    const msg = extractErrorMessage(error)
    if (shouldTriggerCaptcha(msg)) {
      pendingLogin.username = loginForm.username
      pendingLogin.password = loginForm.password
      captchaVisible.value = true
      message.info(t('auth.completeCaptcha'))
    } else {
      message.error(msg)
    }
  } finally {
    loginLoading.value = false
  }
}

const handleCaptchaLoginSuccess = (payload) => {
  captchaVisible.value = false
  pendingLogin.username = ''
  pendingLogin.password = ''
  applyLoginSuccess(payload)
}

const handleRegister = async () => {
  registerLoading.value = true
  try {
    await http.post('/auth/register', {
      username: registerForm.username,
      password: registerForm.password,
      email: registerForm.email,
    })
    message.success(t('auth.registerSuccess'))
    activeTabKey.value = 'login'
    clearRegisterForm()
  } catch (error) {
    message.error(extractErrorMessage(error))
  } finally {
    registerLoading.value = false
  }
}

watch(
  () => activeTabKey.value,
  () => {
    if (activeTabKey.value === 'login') {
      registerFormRef.value?.resetFields?.()
    } else {
      clearLoginForm()
      loginFormRef.value?.resetFields?.()
    }
  },
)
</script>

<template>
  <section class="auth-panel">
    <a-card class="auth-card" bordered="false">
      <a-tabs v-model:activeKey="activeTabKey" centered size="large">
        <a-tab-pane :key="'login'" :tab="t('auth.loginTab')">
          <a-form
            ref="loginFormRef"
            :model="loginForm"
            :rules="loginRules"
            layout="vertical"
            autocomplete="off"
            @finish="handleLogin"
          >
            <a-form-item :label="t('auth.adminAccount')" name="username">
              <a-input
                v-model:value="loginForm.username"
                size="large"
                :placeholder="t('auth.adminAccountPlaceholder')"
              >
                <template #prefix>
                  <UserOutlined />
                </template>
              </a-input>
            </a-form-item>
            <a-form-item :label="t('auth.password')" name="password">
              <a-input-password
                v-model:value="loginForm.password"
                size="large"
                :placeholder="t('auth.passwordPlaceholder')"
              >
                <template #prefix>
                  <LockOutlined />
                </template>
              </a-input-password>
            </a-form-item>
            <a-form-item>
              <a-button
                block
                html-type="submit"
                size="large"
                type="primary"
                :loading="loginLoading"
              >
                {{ t('auth.submitLogin') }}
              </a-button>
            </a-form-item>
          </a-form>
        </a-tab-pane>
        <a-tab-pane :key="'register'" :tab="t('auth.registerTab')">
          <a-form
            ref="registerFormRef"
            :model="registerForm"
            :rules="registerRules"
            layout="vertical"
            autocomplete="off"
            @finish="handleRegister"
          >
            <a-form-item :label="t('auth.adminAccount')" name="username">
              <a-input
                v-model:value="registerForm.username"
                size="large"
                :placeholder="t('auth.createAdminAccountPlaceholder')"
              >
                <template #prefix>
                  <UserOutlined />
                </template>
              </a-input>
            </a-form-item>
            <a-form-item :label="t('auth.password')" name="password">
              <a-input-password
                v-model:value="registerForm.password"
                size="large"
                :placeholder="t('auth.setPasswordPlaceholder')"
              >
                <template #prefix>
                  <LockOutlined />
                </template>
              </a-input-password>
            </a-form-item>
            <a-form-item :label="t('auth.confirmPassword')" name="confirmPassword">
              <a-input-password
                v-model:value="registerForm.confirmPassword"
                size="large"
                :placeholder="t('auth.confirmPasswordPlaceholder')"
              >
                <template #prefix>
                  <LockOutlined />
                </template>
              </a-input-password>
            </a-form-item>
            <a-form-item :label="t('auth.email')" name="email">
              <a-input
                v-model:value="registerForm.email"
                size="large"
                :placeholder="t('auth.emailPlaceholder')"
              >
                <template #prefix>
                  <MailOutlined />
                </template>
              </a-input>
            </a-form-item>
            <a-form-item>
              <a-button
                block
                html-type="submit"
                size="large"
                type="primary"
                :loading="registerLoading"
              >
                {{ t('auth.submitRegister') }}
              </a-button>
            </a-form-item>
          </a-form>
        </a-tab-pane>
      </a-tabs>
    </a-card>
    <CaptchaDialog
      v-model:visible="captchaVisible"
      :username="pendingLogin.username"
      :password="pendingLogin.password"
      @login-success="handleCaptchaLoginSuccess"
    />
  </section>
</template>

<style scoped>
.auth-card {
  background: rgba(255, 255, 255, 0.34);
  border-radius: 28px;
  padding: 2.5rem 2.25rem;
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow: 0 18px 44px rgba(14, 42, 102, 0.14);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.token-alert {
  margin-top: 1.5rem;
  word-break: break-all;
}

.token-alert code {
  background: rgba(15, 23, 42, 0.08);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  display: block;
  color: #0b1b44;
}
</style>
