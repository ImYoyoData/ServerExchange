<script setup lang="ts">
import { useI18n } from "vue-i18n";
import Motion from "./utils/motion";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import { loginRules } from "./utils/rule";
import { ref, reactive, toRaw } from "vue";
import { debounce } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useEventListener } from "@vueuse/core";
import type { FormInstance } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { useLayout } from "@/layout/hooks/useLayout";
import { useUserStoreHook } from "@/store/modules/user";
import { initRouter, getTopMenu } from "@/router/utils";
import { InitDict } from "@/hooks/dict";
import { bg, avatar, illustration } from "./utils/static";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import ReSliderCaptcha from "@/components/ReSliderCaptcha";
import { useTranslationLang } from "@/layout/hooks/useTranslationLang";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";

import dayIcon from "@/assets/svg/day.svg?component";
import darkIcon from "@/assets/svg/dark.svg?component";
import globalization from "@/assets/svg/globalization.svg?component";
import Lock from "~icons/ri/lock-fill";
import Check from "~icons/ep/check";
import User from "~icons/ri/user-3-fill";

defineOptions({
  name: "Login"
});

const router = useRouter();
const loading = ref(false);
const disabled = ref(false);
const captchaVisible = ref(false);
const ruleFormRef = ref<FormInstance>();

const { initStorage } = useLayout();
initStorage();

const { t } = useI18n();
const { dataTheme, overallStyle, dataThemeChange } = useDataThemeChange();
dataThemeChange(overallStyle.value);
const { title, getDropdownItemStyle, getDropdownItemClass } = useNav();
const { locale, translationCh, translationEn, translationRu } =
  useTranslationLang();

const ruleForm = reactive({
  username: "admin",
  password: "admin123"
});

const resetCaptcha = () => {
  captchaVisible.value = false;
};

const onCaptchaFail = () => {
  message(t("login.pureCaptchaFail"), { type: "warning" });
};

const submitLogin = () => {
  loading.value = true;
  useUserStoreHook()
    .loginByUsername({
      username: ruleForm.username,
      password: ruleForm.password
    })
    .then(res => {
      const ok =
        res?.success === true || res?.code === 0 || res?.code === 200;
      if (ok) {
        return initRouter().then(async () => {
          await InitDict();
          disabled.value = true;
          router
            .push(getTopMenu(true).path)
            .then(() => {
              message(t("login.pureLoginSuccess"), { type: "success" });
            })
            .finally(() => (disabled.value = false));
        });
      }
      message(t("login.pureLoginFail"), { type: "error" });
    })
    .catch(() => {})
    .finally(() => (loading.value = false));
};

const onCaptchaSuccess = () => {
  captchaVisible.value = false;
  submitLogin();
};

const onLogin = async (formEl: FormInstance | undefined) => {
  if (!formEl || loading.value) return;
  await formEl.validate(valid => {
    if (valid) captchaVisible.value = true;
  });
};

const immediateDebounce: any = debounce(
  formRef => onLogin(formRef),
  1000,
  true
);

useEventListener(document, "keydown", ({ code }) => {
  if (
    ["Enter", "NumpadEnter"].includes(code) &&
    !disabled.value &&
    !loading.value &&
    !captchaVisible.value
  )
    immediateDebounce(ruleFormRef.value);
});
</script>

<template>
  <div class="select-none">
    <img :src="bg" class="wave" />
    <div class="flex-c absolute right-5 top-3">
      <!-- 主题 -->
      <el-switch
        v-model="dataTheme"
        inline-prompt
        :active-icon="dayIcon"
        :inactive-icon="darkIcon"
        @change="dataThemeChange"
      />
      <!-- 国际化 -->
      <el-dropdown trigger="click">
        <globalization
          class="hover:text-primary hover:bg-[transparent]! w-[20px] h-[20px] ml-1.5 cursor-pointer outline-hidden duration-300"
        />
        <template #dropdown>
          <el-dropdown-menu class="translation">
            <el-dropdown-item
              :style="getDropdownItemStyle(locale, 'zh')"
              :class="['dark:text-white!', getDropdownItemClass(locale, 'zh')]"
              @click="translationCh"
            >
              <IconifyIconOffline
                v-show="locale === 'zh'"
                class="check-zh"
                :icon="Check"
              />
              简体中文
            </el-dropdown-item>
            <el-dropdown-item
              :style="getDropdownItemStyle(locale, 'en')"
              :class="['dark:text-white!', getDropdownItemClass(locale, 'en')]"
              @click="translationEn"
            >
              <span v-show="locale === 'en'" class="check-en">
                <IconifyIconOffline :icon="Check" />
              </span>
              English
            </el-dropdown-item>
            <el-dropdown-item
              :style="getDropdownItemStyle(locale, 'ru')"
              :class="['dark:text-white!', getDropdownItemClass(locale, 'ru')]"
              @click="translationRu"
            >
              <span v-show="locale === 'ru'" class="check-en">
                <IconifyIconOffline :icon="Check" />
              </span>
              Русский
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <div class="login-container">
      <div class="img">
        <component :is="toRaw(illustration)" />
      </div>
      <div class="login-box">
        <div class="login-form">
          <avatar class="avatar" />
          <Motion>
            <h2 class="outline-hidden">{{ title }}</h2>
          </Motion>

          <el-form
            ref="ruleFormRef"
            :model="ruleForm"
            :rules="loginRules"
            size="large"
          >
            <Motion :delay="100">
              <el-form-item
                :rules="[
                  {
                    required: true,
                    message: transformI18n($t('login.pureUsernameReg')),
                    trigger: 'blur'
                  }
                ]"
                prop="username"
              >
                <el-input
                  v-model="ruleForm.username"
                  clearable
                  :placeholder="t('login.pureUsername')"
                  :prefix-icon="useRenderIcon(User)"
                />
              </el-form-item>
            </Motion>

            <Motion :delay="150">
              <el-form-item prop="password">
                <el-input
                  v-model="ruleForm.password"
                  clearable
                  show-password
                  :placeholder="t('login.purePassword')"
                  :prefix-icon="useRenderIcon(Lock)"
                />
              </el-form-item>
            </Motion>

            <Motion :delay="200">
              <el-button
                class="w-full login-submit-btn"
                size="default"
                type="primary"
                :loading="loading"
                :disabled="disabled"
                @click="onLogin(ruleFormRef)"
              >
                {{ t("login.pureLogin") }}
              </el-button>
            </Motion>
          </el-form>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="captchaVisible"
      :title="t('login.pureCaptchaTitle')"
      width="380px"
      align-center
      destroy-on-close
      :close-on-click-modal="false"
      class="login-captcha-dialog"
      @closed="resetCaptcha"
    >
      <ReSliderCaptcha
        v-if="captchaVisible"
        :height="160"
        :dark="dataTheme"
        :locale="locale"
        @success="onCaptchaSuccess"
        @fail="onCaptchaFail"
      />
    </el-dialog>
  </div>
</template>

<style scoped>
@import url("@/style/login.css");
</style>

<style lang="scss" scoped>
:deep(.el-input-group__append, .el-input-group__prepend) {
  padding: 0;
}

.login-submit-btn {
  margin-top: 16px;
}

.login-captcha-dialog {
  :deep(.el-dialog__body) {
    padding-top: 8px;
    padding-bottom: 20px;
  }
}

.translation {
  ::v-deep(.el-dropdown-menu__item) {
    padding: 5px 40px;
  }

  .check-zh {
    position: absolute;
    left: 20px;
  }

  .check-en {
    position: absolute;
    left: 20px;
  }
}
</style>
