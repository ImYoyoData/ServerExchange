import type { OptionsType } from "@/components/ReSegmented";
import { useDark } from "@pureadmin/utils";
import { computed } from "vue";

export const enabledOptions = [
  {
    label: "启用",
    value: true
  },
  {
    label: "禁用",
    value: false
  }
];
export const enabledMap = { true: "启用", false: "禁用" };

export function usePublicHooks() {
  const { isDark } = useDark();

  const switchStyle = computed(() => {
    return {
      "--el-switch-on-color": "#6abe39",
      "--el-switch-off-color": "#e84749"
    };
  });

  const tagStyle = computed(() => {
    return (status: number) => {
      return status === 1
        ? {
            "--el-tag-text-color": isDark.value ? "#6abe39" : "#389e0d",
            "--el-tag-bg-color": isDark.value ? "#172412" : "#f6ffed",
            "--el-tag-border-color": isDark.value ? "#274a17" : "#b7eb8f"
          }
        : {
            "--el-tag-text-color": isDark.value ? "#e84749" : "#cf1322",
            "--el-tag-bg-color": isDark.value ? "#2b1316" : "#fff1f0",
            "--el-tag-border-color": isDark.value ? "#58191c" : "#ffa39e"
          };
    };
  });
  const tagEnabledStyle = computed(() => {
    return (status: boolean) => {
      return status
        ? {
            "--el-tag-text-color": isDark.value ? "#6abe39" : "#389e0d",
            "--el-tag-bg-color": isDark.value ? "#172412" : "#f6ffed",
            "--el-tag-border-color": isDark.value ? "#274a17" : "#b7eb8f"
          }
        : {
            "--el-tag-text-color": isDark.value ? "#e84749" : "#cf1322",
            "--el-tag-bg-color": isDark.value ? "#2b1316" : "#fff1f0",
            "--el-tag-border-color": isDark.value ? "#58191c" : "#ffa39e"
          };
    };
  });

  return {
    /** 当前网页是否为`dark`模式 */
    isDark,
    /** 表现更鲜明的`el-switch`组件  */
    switchStyle,
    /** 表现更鲜明的`el-tag`组件  */
    tagStyle,
    /** 表现更鲜明的`el-tag`组件  */
    tagEnabledStyle
  };
}

export const menuTypeOptions: Array<OptionsType> = [
  {
    label: "菜单",
    value: 1
  },
  {
    label: "iframe",
    value: 2
  },
  {
    label: "外链",
    value: 3
  },
  {
    label: "按钮",
    value: 4
  }
];
export const menuTypeOptionMap = {
  1: "菜单",
  2: "iframe",
  3: "外链",
  4: "按钮"
};

export const menuShowLinkOptions: Array<OptionsType> = [
  {
    label: "显示",
    tip: "会在菜单中显示",
    value: true
  },
  {
    label: "隐藏",
    tip: "不会在菜单中显示",
    value: false
  }
];

export const menuKeepAliveOptions: Array<OptionsType> = [
  {
    label: "缓存",
    tip: "会保存该页面的整体状态，刷新后会清空状态",
    value: true
  },
  {
    label: "不缓存",
    tip: "不会保存该页面的整体状态",
    value: false
  }
];

export const menuHiddenTagOptions: Array<OptionsType> = [
  {
    label: "允许",
    tip: "当前菜单名称或自定义信息允许添加到标签页",
    value: false
  },
  {
    label: "禁止",
    tip: "当前菜单名称或自定义信息禁止添加到标签页",
    value: true
  }
];

export const menuShowParentOptions: Array<OptionsType> = [
  {
    label: "显示",
    tip: "会显示父级菜单",
    value: true
  },
  {
    label: "隐藏",
    tip: "不会显示父级菜单",
    value: false
  }
];

export const menuFrameLoadingOptions: Array<OptionsType> = [
  {
    label: "开启",
    tip: "有首次加载动画",
    value: true
  },
  {
    label: "关闭",
    tip: "无首次加载动画",
    value: false
  }
];

export const getMenuType = (type, text = false) => {
  switch (type) {
    case 1:
      return text ? "菜单" : "primary";
    case 2:
      return text ? "iframe" : "warning";
    case 3:
      return text ? "外链" : "danger";
    case 4:
      return text ? "按钮" : "info";
  }
};

export const genderMap = { 1: "男生", 2: "女生", 0: "保密" };

export const genderOptions = [
  {
    label: "男生",
    value: 1
  },
  {
    label: "女生",
    value: 2
  },
  {
    label: "保密",
    value: 0
  }
];

export const dataScopeOptions = [
  {
    label: "全部数据",
    value: 0
  },
  {
    label: "本级机构",
    value: 1
  },
  {
    label: "本级及子级机构",
    value: 2
  },
  {
    label: "自定义数据范围",
    value: 3
  }
];
