import "./reset.css";
import dayjs from "dayjs";
import roleForm from "../form/role.vue";
import editForm from "../form/index.vue";
import { zxcvbn } from "@zxcvbn-ts/core";
import { message } from "@/utils/message";
import userAvatar from "@/assets/user.jpg";
import { usePublicHooks } from "../../hooks";
import { addDialog } from "@/components/ReDialog";
import type { PaginationProps } from "@pureadmin/table";
import ReCropperPreview from "@/components/ReCropperPreview";
import type { FormItemProps, RoleFormItemProps } from "../utils/types";
import {
  getKeyList,
  isAllEmpty,
  hideTextAtIndex,
  deviceDetection
} from "@pureadmin/utils";
import {
  getRoleIds,
  getUserList,
  getAllRoleList,
  addUser,
  updateUser,
  deleteUsers,
  assignRole,
  resetPassword
} from "@/api/system";
import { uploadAdminFile } from "@/api/file";
import { PURE_TABLE_PAGE_SIZES } from "@/utils/pureTable";
import {
  ElForm,
  ElInput,
  ElFormItem,
  ElIcon,
  ElProgress,
  ElMessageBox
} from "element-plus";
import { View, Hide } from "@element-plus/icons-vue";
import {
  type Ref,
  h,
  ref,
  toRaw,
  watch,
  computed,
  reactive,
  onMounted
} from "vue";

export function useUser(tableRef: Ref) {
  const form = reactive({
    // 左侧部门树的id
    username: "",
    phone: "",
    status: "",
    page: 1,
    pageSize: 10
  });
  const formRef = ref();
  const ruleFormRef = ref();
  const dataList = ref([]);
  const loading = ref(true);
  // 上传头像信息
  const avatarInfo = ref();
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  const selectedNum = ref(0);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    background: true,
    pageSizes: PURE_TABLE_PAGE_SIZES
  });
  /** 仅一行可显示完整手机号；点其它行的眼睛时上一行自动恢复脱敏 */
  const revealedPhoneRowId = ref<string | number | null>(null);

  const columns = computed<TableColumnList>(() => {
    void revealedPhoneRowId.value;
    return [
      {
        label: "勾选列", // 如果需要表格多选，此处label必须设置
        type: "selection",
        fixed: "left",
        reserveSelection: true // 数据刷新后保留选项
      },
      {
        label: "用户编号",
        prop: "id",
        width: 90
      },
      {
        label: "用户头像",
        prop: "avatar",
        cellRenderer: ({ row }) => (
          <el-image
            fit="cover"
            preview-teleported={true}
            src={row.avatar_url || row.avatar || userAvatar}
            preview-src-list={Array.of(
              row.avatar_url || row.avatar || userAvatar
            )}
            class="size-6 rounded-full align-middle"
          />
        ),
        width: 90
      },
      {
        label: "用户名称",
        prop: "username",
        minWidth: 130
      },
      {
        label: "用户昵称",
        prop: "nickname",
        minWidth: 130
      },
      {
        label: "性别",
        prop: "sex",
        minWidth: 90,
        cellRenderer: ({ row, props }) => (
          <el-tag
            size={props.size}
            type={row.sex === 1 ? "danger" : null}
            effect="plain"
          >
            {[0, 1].includes(row.sex) ? (row.sex === 1 ? "女" : "男") : "未知"}
          </el-tag>
        )
      },
      {
        label: "手机号码",
        prop: "phone",
        minWidth: 130,
        cellRenderer: ({ row }) => {
          const raw = String(row.phone ?? "").trim();
          if (!raw) {
            return <span>-</span>;
          }
          const masked = hideTextAtIndex(raw, { start: 3, end: 6 });
          const revealed = revealedPhoneRowId.value === row.id;
          return (
            <div class="inline-flex items-center justify-center gap-1">
              <span
                class="tabular-nums select-text cursor-text"
                title="可选中复制"
              >
                {revealed ? raw : masked}
              </span>
              <el-button
                link
                type="primary"
                class="!p-0.5 !min-h-0 !h-6 !align-middle"
                aria-label={revealed ? "隐藏完整手机号码" : "显示完整手机号码"}
                onClick={(e: MouseEvent) => {
                  e.stopPropagation();
                  revealedPhoneRowId.value =
                    revealedPhoneRowId.value === row.id ? null : row.id;
                }}
              >
                <ElIcon class="text-base">
                  {revealed ? <Hide /> : <View />}
                </ElIcon>
              </el-button>
            </div>
          );
        }
      },
      {
        label: "状态",
        prop: "status",
        minWidth: 90,
        cellRenderer: scope => (
          <el-switch
            size={scope.props.size === "small" ? "small" : "default"}
            loading={switchLoadMap.value[scope.index]?.loading}
            v-model={scope.row.status}
            active-value={true}
            inactive-value={false}
            active-text="已启用"
            inactive-text="已停用"
            inline-prompt
            style={switchStyle.value}
            onChange={() => onChange(scope as any)}
          />
        )
      },
      {
        label: "创建时间",
        minWidth: 90,
        prop: "createdAt",
        formatter: ({ createdAt }) =>
          dayjs(createdAt).format("YYYY-MM-DD HH:mm:ss")
      },
      {
        label: "操作",
        fixed: "right",
        width: 180,
        slot: "operation"
      }
    ];
  });
  const buttonClass = computed(() => {
    return [
      "h-5!",
      "reset-margin",
      "text-gray-500!",
      "dark:text-white!",
      "dark:hover:text-primary!"
    ];
  });
  // 重置的新密码
  const pwdForm = reactive({
    newPwd: ""
  });
  const pwdProgress = [
    { color: "#e74242", text: "非常弱" },
    { color: "#EFBD47", text: "弱" },
    { color: "#ffa500", text: "一般" },
    { color: "#1bbf1b", text: "强" },
    { color: "#008000", text: "非常强" }
  ];
  // 当前密码强度（0-4）
  const curScore = ref();
  const roleOptions = ref([]);

  function onChange({ row, index }) {
    const isDisabling = row.status === false || row.status === 0;
    const confirmHtml = isDisabling
      ? `确认要<strong>停用</strong>用户 <strong style='color:var(--el-color-primary)'>${row.username}</strong> 吗？<p style="margin:12px 0 0;line-height:1.5;color:var(--el-text-color-regular)">此操作会<strong style="color:var(--el-color-danger)">清除该用户的登录状态</strong>（已登录会话将被踢出）。</p><p style="margin:8px 0 0">是否继续？</p>`
      : `确认要<strong>启用</strong>用户 <strong style='color:var(--el-color-primary)'>${row.username}</strong> 吗？`;

    ElMessageBox.confirm(confirmHtml, "系统提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
      dangerouslyUseHTMLString: true,
      draggable: true
    })
      .then(() => {
        switchLoadMap.value[index] = Object.assign(
          {},
          switchLoadMap.value[index],
          {
            loading: true
          }
        );
        updateUser({ id: row.id, status: row.status })
          .then(res => {
            if (res.success) {
              message("已成功修改用户状态", {
                type: "success"
              });
            }
          })
          .catch(() => {
            row.status = !row.status;
          })
          .finally(() => {
            switchLoadMap.value[index] = Object.assign(
              {},
              switchLoadMap.value[index],
              {
                loading: false
              }
            );
          });
      })
      .catch(() => {
        row.status = !row.status;
      });
  }

  function handleUpdate(_row) {
    // console.log(_row);
  }

  function handleDelete(row) {
    deleteUsers([row.id]).then(res => {
      if (res.success) {
        message(`您删除了用户编号为${row.id}的这条数据`, { type: "success" });
        onSearch();
      }
    });
  }

  function handleSizeChange(val: number) {
    console.log(`${val} items per page`);
    form.pageSize = val;
    onSearch();
  }

  function handleCurrentChange(val: number) {
    console.log(`current page: ${val}`);
    form.page = val;
    onSearch();
  }

  /** 当CheckBox选择项发生变化时会触发该事件 */
  function handleSelectionChange(val) {
    selectedNum.value = val.length;
    // 重置表格高度
    tableRef.value.setAdaptive();
  }

  /** 取消选择 */
  function onSelectionCancel() {
    selectedNum.value = 0;
    // 用于多选表格，清空用户的选择
    tableRef.value.getTableRef().clearSelection();
  }

  /** 批量删除 */
  function onbatchDel() {
    // 返回当前选中的行
    const curSelected = tableRef.value.getTableRef().getSelectionRows();
    // 接下来根据实际业务，通过选中行的某项数据，比如下面的id，调用接口进行批量删除
    const ids = getKeyList(curSelected, "id");
    deleteUsers(ids).then(res => {
      if (res.success) {
        message(`已删除用户编号为 ${ids} 的数据`, {
          type: "success"
        });
        tableRef.value.getTableRef().clearSelection();
        onSearch();
      }
    });
  }

  async function onSearch() {
    loading.value = true;
    const { success, data } = await getUserList(toRaw(form));
    if (success) {
      dataList.value = data.list;
      pagination.total = data.total;
      pagination.pageSize = data.pageSize;
      pagination.currentPage = data.currentPage;
    }

    setTimeout(() => {
      loading.value = false;
    }, 500);
  }

  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
    onSearch();
  };

  function openDialog(title = "新增", row?: FormItemProps) {
    addDialog({
      title: `${title}用户`,
      props: {
        formInline: {
          title,
          nickname: row?.nickname ?? "",
          username: row?.username ?? "",
          password: row?.password ?? "",
          phone: row?.phone ?? "",
          email: row?.email ?? "",
          sex: row?.sex ?? "",
          status: row?.status ?? 1,
          remark: row?.remark ?? ""
        }
      },
      width: "46%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef, formInline: null }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;
        function chores() {
          message(`您${title}了用户名称为${curData.username}的这条数据`, {
            type: "success"
          });
          done(); // 关闭弹框
          onSearch(); // 刷新表格数据
        }
        FormRef.validate(valid => {
          if (valid) {
            console.log("curData", curData);
            // 表单规则校验通过
            if (title === "新增") {
              // 实际开发先调用新增接口，再进行下面操作
              addUser(curData).then(res => {
                if (res.success) {
                  chores();
                }
              });
            } else {
              // 实际开发先调用修改接口，再进行下面操作
              delete curData.password; // 删除密码字段 因为是单独修改密码的
              updateUser({
                id: row.id,
                ...curData
              }).then(res => {
                if (res.success) {
                  chores();
                }
              });
            }
          }
        });
      }
    });
  }

  const cropRef = ref();
  function resolveUploadedId(res: any): string | number | null {
    const id = res?.data?.id ?? res?.data?.fileId ?? res?.data?.data?.id;
    if (id === undefined || id === null || id === "") return null;
    return id;
  }

  function blobToFile(blob: Blob, filename: string) {
    return new File([blob], filename, {
      type: blob.type || "image/png"
    });
  }

  /** 上传头像 */
  function handleUpload(row) {
    addDialog({
      title: "裁剪、上传头像",
      width: "40%",
      closeOnClickModal: false,
      fullscreen: deviceDetection(),
      contentRenderer: () =>
        h(ReCropperPreview, {
          ref: cropRef,
          imgSrc: row.avatar_url || row.avatar || userAvatar,
          onCropper: info => (avatarInfo.value = info)
        }),
      beforeSure: async done => {
        const blob = avatarInfo.value?.blob as Blob | undefined;
        if (!blob) {
          message("请先裁剪头像后再保存", { type: "warning" });
          return;
        }
        const ext = blob.type?.includes("jpeg")
          ? "jpg"
          : blob.type?.includes("png")
            ? "png"
            : "jpg";
        const file = blobToFile(blob, `avatar_${row.id}.${ext}`);
        const uploadRes: any = await uploadAdminFile(file, "admin_user_avatar");
        const uploadOk =
          uploadRes?.success === true ||
          uploadRes?.code === 200 ||
          uploadRes?.code === 201;
        if (!uploadOk) {
          message(uploadRes?.message ?? "头像上传失败", { type: "error" });
          return;
        }
        const avatar = resolveUploadedId(uploadRes);
        if (avatar == null) {
          message("上传成功但未获取到文件ID", { type: "error" });
          return;
        }
        const saveRes: any = await updateUser({
          id: row.id,
          avatar
        });
        if (!(saveRes?.success === true || saveRes?.code === 200)) {
          message(saveRes?.message ?? "头像保存失败", { type: "error" });
          return;
        }
        message("头像更新成功", { type: "success" });
        done(); // 关闭弹框
        onSearch(); // 刷新表格数据
      },
      closeCallBack: () => cropRef.value.hidePopover()
    });
  }

  watch(
    pwdForm,
    ({ newPwd }) =>
      (curScore.value = isAllEmpty(newPwd) ? -1 : zxcvbn(newPwd).score)
  );

  /** 重置密码 */
  function handleReset(row) {
    addDialog({
      title: `重置 ${row.username} 用户的密码`,
      width: "30%",
      draggable: true,
      closeOnClickModal: false,
      fullscreen: deviceDetection(),
      contentRenderer: () => (
        <>
          <ElForm ref={ruleFormRef} model={pwdForm}>
            <ElFormItem
              prop="newPwd"
              rules={[
                {
                  required: true,
                  message: "请输入新密码",
                  trigger: "blur"
                }
              ]}
            >
              <ElInput
                clearable
                show-password
                type="password"
                v-model={pwdForm.newPwd}
                placeholder="请输入新密码"
              />
            </ElFormItem>
          </ElForm>
          <div class="my-4 flex">
            {pwdProgress.map(({ color, text }, idx) => (
              <div
                class="w-[19vw]"
                style={{ marginLeft: idx !== 0 ? "4px" : 0 }}
              >
                <ElProgress
                  striped
                  striped-flow
                  duration={curScore.value === idx ? 6 : 0}
                  percentage={curScore.value >= idx ? 100 : 0}
                  color={color}
                  stroke-width={10}
                  show-text={false}
                />
                <p
                  class="text-center"
                  style={{ color: curScore.value === idx ? color : "" }}
                >
                  {text}
                </p>
              </div>
            ))}
          </div>
        </>
      ),
      closeCallBack: () => (pwdForm.newPwd = ""),
      beforeSure: done => {
        ruleFormRef.value.validate(valid => {
          if (valid) {
            // 表单规则校验通过
            resetPassword(row.id, pwdForm.newPwd).then(res => {
              if (res.success) {
                message(`已成功重置 ${row.username} 用户的密码`, {
                  type: "success"
                });
                // console.log(pwdForm.newPwd);
                // 根据实际业务使用pwdForm.newPwd和row里的某些字段去调用重置用户密码接口即可
                done(); // 关闭弹框
                onSearch(); // 刷新表格数据
              }
            });
          }
        });
      }
    });
  }

  /** 分配角色 */
  async function handleRole(row) {
    // 选中的角色列表
    const ids = (await getRoleIds(row.id)).data ?? [];
    addDialog({
      title: `分配 ${row.username} 用户的角色`,
      props: {
        formInline: {
          username: row?.username ?? "",
          nickname: row?.nickname ?? "",
          roleOptions: roleOptions.value ?? [],
          ids
        }
      },
      width: "400px",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(roleForm),
      beforeSure: (done, { options }) => {
        const curData = options.props.formInline as RoleFormItemProps;
        // console.log("curIds", curData.ids);
        assignRole(row.id, curData.ids).then(res => {
          if (res.success) {
            message(`已成功分配 ${row.username} 用户的角色`, {
              type: "success"
            });
            done(); // 关闭弹框
          }
        });
      }
    });
  }

  onMounted(async () => {
    onSearch();

    // 角色列表
    roleOptions.value = (await getAllRoleList()).data ?? [];
  });

  return {
    form,
    loading,
    columns,
    dataList,
    selectedNum,
    pagination,
    buttonClass,
    deviceDetection,
    onSearch,
    resetForm,
    onbatchDel,
    openDialog,
    handleUpdate,
    handleDelete,
    handleUpload,
    handleReset,
    handleRole,
    handleSizeChange,
    onSelectionCancel,
    handleCurrentChange,
    handleSelectionChange
  };
}
