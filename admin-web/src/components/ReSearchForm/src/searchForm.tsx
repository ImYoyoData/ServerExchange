import { computed, defineComponent, ref } from "vue";
import type { SearchFormItem, SearchFormItems } from "./types";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { ArrowDown, ArrowUp } from "@element-plus/icons-vue";

const props = {
  /**
   * 是否展示
   */
  show: {
    type: Boolean,
    default: true
  },
  /**
   * 表单对齐方式
   */
  position: {
    type: String as PropType<"top" | "right" | "left">,
    default: "right"
  },
  /**
   * 表单大小
   */
  size: {
    type: String as PropType<"" | "default" | "small" | "large">,
    default: ""
  },
  /**
   * 查询权限
   */
  permission: {
    required: false,
    type: Object as PropType<string | string[]>,
    default: () => []
  },
  /**
   * 下拉数据源
   */
  dataSource: {
    required: false,
    type: Object as PropType<Record<string, any[]>>,
    default: () => ({})
  },
  /**
   * 表单配置
   */
  formItems: {
    required: true,
    type: Array as PropType<SearchFormItems>
  },
  /**
   * 展示条数
   */
  showNumber: {
    type: Number,
    default: 3
  },
  /**
   * 是否展开
   */
  hasUnfold: {
    type: Boolean,
    default: true
  }
};

/**
 * @description 搜索表单
 */
export default defineComponent({
  name: "SearchForm",
  props,
  emits: ["search", "reset", "searchForm", "change", "calenderChange"],
  setup(props, { emit, attrs }) {
    const formDate = ref({});

    const showAll = ref(false);

    const word = computed(() => {
      return showAll.value ? "收起" : "展开";
    });

    const inputItem = (item: SearchFormItem) => {
      if (item.type !== "input") return;
      return (
        <el-input
          v-model={formDate.value[item.options?.prop]}
          placeholder={item.options?.placeholder}
          clearable={item.options?.clearable ?? true}
          maxlength={item.options?.maxlength}
          minlength={item.options?.minlength}
          class="!w-[180px]"
          onChange={_change(item)}
        />
      );
    };
    const selectItem = (item: SearchFormItem) => {
      if (item.type !== "select") return;
      return (
        <el-select
          v-model={formDate.value[item.options?.prop]}
          placeholder={item.options?.placeholder}
          multiple={item.options?.multiple}
          filterable={item.options?.filterable ?? true}
          clearable={item.options?.clearable ?? true}
          class="!w-[180px]"
          style="width: 100%"
        >
          {props?.dataSource[item.options?.dataSourceKey]?.map(
            (option: any) => (
              <el-option
                key={option[item.options?.selectOptionKey?.value ?? "value"]}
                label={option[item.options?.selectOptionKey?.label ?? "label"]}
                value={option[item.options?.selectOptionKey?.value ?? "value"]}
              />
            )
          )}
        </el-select>
      );
    };
    const dateItem = (item: SearchFormItem) => {
      if (item.type !== "date") return;
      return (
        <el-date-picker
          v-model={formDate.value[item.options?.prop]}
          placeholder={item.options?.placeholder}
          clearable={item.options?.clearable ?? true}
          type={item.options?.dateType ?? "date"}
          format={item.options?.format ?? "YYYY-MM-dd"}
          value-format={item.options?.valueFormat ?? "YYYY-MM-dd"}
          disabled-date={item?.options?.disabledDate ?? undefined}
          style="width: 100%"
        />
      );
    };
    const dateCycle = (item: SearchFormItem) => {
      if (item.type !== "date-cycle") return;
      return (
        <>
          <el-date-picker
            v-model={formDate.value[item.options?.prop + "Start"]}
            placeholder={item.options?.startPlaceholder}
            clearable={item.options?.startClearable ?? true}
            type={item.options?.dateType ?? "date"}
            format={item.options?.format ?? "YYYY-MM-DD"}
            value-format={item.options?.valueFormat ?? "YYYY-MM-DD"}
            disabled-date={item?.options?.startDisabledDate ?? undefined}
            onChange={date => changeStartDateCycle(date, item)}
          />
          ~
          <el-date-picker
            v-model={formDate.value[item.options?.prop + "End"]}
            placeholder={item.options?.endPlaceholder}
            clearable={item.options?.endClearable ?? true}
            type={item.options?.dateType ?? "date"}
            format={item.options?.format ?? "YYYY-MM-DD"}
            value-format={item.options?.valueFormat ?? "YYYY-MM-DD"}
            disabledDate={date => endDateCycleDisabled(date, item)}
          ></el-date-picker>
        </>
      );
    };
    /**
     *  表单默认值
     * @returns
     */
    function getDefaultValue() {
      const fields: SearchFormItem[] = props.formItems;
      const obj: any = {};
      fields.forEach(item => {
        obj[item.options?.prop] = item.options?.defaultValue ?? null;
      });
      // 删除 null的字段
      /* eslint-disable @typescript-eslint/no-dynamic-delete */
      obj &&
        Object.keys(obj).forEach(key => obj[key] === null && delete obj[key]);

      return obj;
    }
    /**
     * date-cycle 开始时间的变更
     */
    function changeStartDateCycle(value, item) {
      formDate.value[item.options?.prop + "End"] = "";
    }
    /**
     * date-cycle 结束时间禁止事件
     *
     * @param value 当前时间
     * @param item 当前formItem
     */
    function endDateCycleDisabled(value, item): boolean {
      const startDate = formDate.value[item.options?.prop + "Start"];
      if (startDate) {
        // 结束时间小于开始时间
        return value.getTime() < new Date(startDate).getTime();
      }
      return false;
    }

    /**
     * 表单项值改变
     *@param item 表单项
     */
    function _change(item?: SearchFormItem) {
      _searchForm();
      emit("change", item);
    }
    /**
     * 表单重置
     */
    function _searchReset() {
      const defaultData = getDefaultValue();
      formDate.value = defaultData;
      _searchForm(defaultData);
      emit("reset");
    }
    /**
     * 值的变化
     *
     * @param data .
     */
    function _searchForm(data?: any) {
      const obj = {};
      Object.assign(obj, data || formDate.value);
      // 删除 undefined,'',null的字段
      /* eslint-disable @typescript-eslint/no-dynamic-delete */
      obj &&
        Object.keys(obj).forEach(
          key =>
            (obj[key] === undefined || obj[key] === "" || obj[key] === null) &&
            delete obj[key]
        );

      emit("searchForm", obj);
    }
    /**
     * 表单查询
     */
    function _search() {
      _searchForm();
      emit("search");
    }

    /**
     * 展开/收起
     */
    function _changeShowAll() {
      console.log(showAll.value);
      showAll.value = !showAll.value;
    }

    return () => (
      <>
        <el-form
          {...attrs}
          inline={true}
          label-width="auto"
          label-position={props.position}
          size={props.size}
          v-show={props.show}
          class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px]"
        >
          {/* {props.formItems?.map((item: SearchFormItem) => {
            return (
              <el-form-item
                label={item.label}
                key={item.label}
                v-show={item.hide ?? true}
              >
                {inputItem(item)}
                {selectItem(item)}
                {dateItem(item)}
                {dateCycle(item)}
              </el-form-item>
            );
          })} */}
          {props.formItems?.map((item: SearchFormItem, index) => {
            return (
              <el-form-item
                label={item.label}
                key={item.label}
                v-show={
                  !props.hasUnfold || showAll.value || index < props.showNumber
                }
              >
                {inputItem(item)}
                {selectItem(item)}
                {dateItem(item)}
                {dateCycle(item)}
              </el-form-item>
            );
          })}
          <el-form-item>
            <el-button
              plain
              type="primary"
              icon={useRenderIcon("ri:search-line")}
              v-auth={props.permission}
              onClick={_search}
            >
              查询
            </el-button>
            <el-button
              plain
              icon={useRenderIcon("ri:refresh-line")}
              onClick={_searchReset}
            >
              重置
            </el-button>
            {props.hasUnfold && props.formItems.length > props.showNumber ? (
              <el-button type="primary" plain link onClick={_changeShowAll}>
                {word.value}{" "}
                {showAll.value ? (
                  <el-icon>
                    <ArrowUp />
                  </el-icon>
                ) : (
                  <el-icon>
                    <ArrowDown />
                  </el-icon>
                )}
              </el-button>
            ) : null}
          </el-form-item>
        </el-form>
      </>
    );
  }
});
