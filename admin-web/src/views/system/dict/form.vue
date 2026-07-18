<script setup lang="ts">
import { reactive, ref } from "vue";
import type { FormRules } from "element-plus";

export interface DictFormItemProps {
  id?: string | number;
  code: string;
  name: string;
  description?: string;
  status: boolean;
}

export interface DictFormProps {
  formInline?: DictFormItemProps;
}

const props = withDefaults(defineProps<DictFormProps>(), {
  formInline: () => ({
    code: "",
    name: "",
    description: "",
    status: true
  })
});

const ruleFormRef = ref();
const newFormInline = ref(props.formInline);

const formRules = reactive<FormRules>({
  name: [{ required: true, message: "字典名称为必填项", trigger: "blur" }],
  code: [{ required: true, message: "字典编码为必填项", trigger: "blur" }],
  status: [{ required: true, message: "请选择状态", trigger: "change" }]
});

function getRef() {
  return ruleFormRef.value;
}

defineExpose({ getRef });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="100px"
  >
    <el-form-item label="字典名称" prop="name">
      <el-input
        v-model="newFormInline.name"
        clearable
        placeholder="请输入字典名称"
      />
    </el-form-item>

    <el-form-item label="字典标识" prop="code">
      <el-input
        v-model="newFormInline.code"
        clearable
        placeholder="请输入字典标识"
      />
    </el-form-item>

    <el-form-item label="字典描述" prop="description">
      <el-input
        v-model="newFormInline.description"
        clearable
        placeholder="请输入字典描述"
      />
    </el-form-item>

    <el-form-item label="状态" prop="status">
      <el-switch
        v-model="newFormInline.status"
        :active-value="true"
        :inactive-value="false"
        active-text="启用"
        inactive-text="禁用"
      />
    </el-form-item>
  </el-form>
</template>
