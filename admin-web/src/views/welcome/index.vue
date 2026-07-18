<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useUserStoreHook } from "@/store/modules/user";

import DashboardLine from "~icons/ri/dashboard-3-line";
import UserSettingsLine from "~icons/ri/user-settings-line";
import FolderLine from "~icons/ri/folder-line";
import BookLine from "~icons/ri/book-2-line";

defineOptions({
  name: "Welcome"
});

const { t } = useI18n();
const userStore = useUserStoreHook();

const displayName = computed(
  () =>
    userStore.nickname?.trim() || userStore.username || t("welcome.pureGuest")
);

/** 静态示意数据，不接接口 */
const overviewStats = [
  { key: "users", value: 128, labelKey: "welcome.pureStatUsers" },
  { key: "roles", value: 12, labelKey: "welcome.pureStatRoles" },
  { key: "files", value: 1024, labelKey: "welcome.pureStatFiles" },
  { key: "dict", value: 56, labelKey: "welcome.pureStatDict" }
] as const;

const moduleCards = [
  {
    icon: UserSettingsLine,
    titleKey: "welcome.pureModUserTitle",
    descKey: "welcome.pureModUserDesc"
  },
  {
    icon: FolderLine,
    titleKey: "welcome.pureModFileTitle",
    descKey: "welcome.pureModFileDesc"
  },
  {
    icon: BookLine,
    titleKey: "welcome.pureModDictTitle",
    descKey: "welcome.pureModDictDesc"
  }
] as const;
</script>

<template>
  <div>
    <el-card class="welcome-hero mb-4" shadow="never">
      <div
        class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div class="min-w-0">
          <p class="welcome-muted mb-1 text-sm">
            {{ t("welcome.pureGreeting") }}{{ displayName }}
          </p>
          <h1
            class="welcome-title text-xl font-semibold tracking-tight md:text-2xl"
          >
            {{ t("welcome.pureTitle") }}
          </h1>
          <p class="welcome-muted mt-2 max-w-2xl text-sm leading-relaxed">
            {{ t("welcome.pureDesc") }}
          </p>
        </div>
        <div
          class="welcome-hero-icon hidden h-14 w-14 shrink-0 items-center justify-center rounded-xl md:flex"
          aria-hidden="true"
        >
          <el-icon class="text-3xl text-white">
            <DashboardLine />
          </el-icon>
        </div>
      </div>
    </el-card>

    <el-card class="mb-4" shadow="never">
      <template #header>
        <div
          class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"
        >
          <span class="font-medium">{{ t("welcome.pureOverview") }}</span>
          <span class="welcome-muted text-xs font-normal">
            {{ t("welcome.pureOverviewHint") }}
          </span>
        </div>
      </template>
      <el-row :gutter="16">
        <el-col
          v-for="item in overviewStats"
          :key="item.key"
          :xs="12"
          :sm="12"
          :md="6"
          class="mb-4 last:mb-0 md:mb-0"
        >
          <div
            class="welcome-stat rounded-lg px-1 py-2 text-center md:px-2 md:py-3"
          >
            <el-statistic :value="item.value" />
            <div class="welcome-muted mt-1 text-xs">
              {{ t(item.labelKey) }}
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card class="mb-4" shadow="never">
      <template #header>
        <span class="font-medium">{{ t("welcome.pureModules") }}</span>
      </template>
      <el-row :gutter="16">
        <el-col
          v-for="(mod, index) in moduleCards"
          :key="index"
          :xs="24"
          :sm="24"
          :md="8"
          class="mb-4 last:mb-0 md:mb-0"
        >
          <div class="welcome-module flex gap-4 rounded-lg p-4">
            <div
              class="welcome-module-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
            >
              <el-icon class="text-xl">
                <component :is="mod.icon" />
              </el-icon>
            </div>
            <div class="min-w-0">
              <div class="font-medium">{{ t(mod.titleKey) }}</div>
              <p class="welcome-muted mt-1 text-sm leading-relaxed">
                {{ t(mod.descKey) }}
              </p>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span class="font-medium">{{ t("welcome.pureTipsTitle") }}</span>
      </template>
      <ul class="welcome-tips list-none space-y-3 pl-0 text-sm leading-relaxed">
        <li class="flex gap-2">
          <span class="welcome-tip-dot mt-2 shrink-0 rounded-full" />
          <span>{{ t("welcome.pureTip1") }}</span>
        </li>
        <li class="flex gap-2">
          <span class="welcome-tip-dot mt-2 shrink-0 rounded-full" />
          <span>{{ t("welcome.pureTip2") }}</span>
        </li>
        <li class="flex gap-2">
          <span class="welcome-tip-dot mt-2 shrink-0 rounded-full" />
          <span>{{ t("welcome.pureTip3") }}</span>
        </li>
      </ul>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.welcome-muted {
  color: var(--el-text-color-secondary);
}

.welcome-title {
  color: var(--el-text-color-primary);
}

.welcome-hero {
  background: linear-gradient(
    135deg,
    var(--el-color-primary-light-9) 0%,
    var(--el-fill-color-blank) 55%
  );
  border: 1px solid var(--pure-border-color);
}

.welcome-hero-icon {
  background: linear-gradient(
    135deg,
    var(--el-color-primary) 0%,
    var(--el-color-primary-light-3) 100%
  );
  box-shadow: 0 8px 24px
    color-mix(in srgb, var(--el-color-primary) 35%, transparent);
}

.welcome-stat {
  background: var(--el-fill-color-light);
  border: 1px solid var(--pure-border-color);
}

.welcome-module {
  border: 1px solid var(--pure-border-color);
  background: var(--el-fill-color-blank);
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: var(--el-box-shadow-lighter);
  }
}

.welcome-module-icon {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.welcome-tip-dot {
  width: 6px;
  height: 6px;
  background: var(--el-color-primary);
}
</style>
