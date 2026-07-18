/*
 Navicat Premium Dump SQL

 Source Server         : 本地数据库
 Source Server Type    : MySQL
 Source Server Version : 50738 (5.7.38-log)
 Source Host           : localhost:3306
 Source Schema         : test

 Target Server Type    : MySQL
 Target Server Version : 50738 (5.7.38-log)
 File Encoding         : 65001

 Date: 29/03/2026 20:35:52
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for sys_admin
-- ----------------------------
DROP TABLE IF EXISTS `sys_admin`;
CREATE TABLE `sys_admin`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '用户名',
  `password` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '密码哈希',
  `nickname` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '昵称',
  `phone` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '手机号码',
  `email` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '电子邮箱',
  `lastLoginAt` datetime NULL DEFAULT NULL COMMENT '最后登录时间',
  `lastLoginIp` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '最后登录IP',
  `isSuperAdmin` tinyint(4) NOT NULL DEFAULT 0 COMMENT '是否超级管理员',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `status` tinyint(4) NOT NULL DEFAULT 1 COMMENT '用户状态 0:禁用 1:正常',
  `sex` int(11) NULL DEFAULT NULL COMMENT '性别 1:女 0:男',
  `remark` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '用户备注',
  `avatar` int(11) NULL DEFAULT NULL COMMENT '头像_文件id',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `IDX_5482e571180adb1467b0c9e72e`(`username`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_admin
-- ----------------------------
INSERT INTO `sys_admin` VALUES (1, 'admin', 'admin123', 'Yoyo', '17666666666', 'qq1294858802@gmail.com', NULL, NULL, 1, '2026-03-13 23:53:36.994691', '2026-03-27 00:07:29.025053', 1, 1, '我是备注信息哦', 4);
INSERT INTO `sys_admin` VALUES (2, 'yoyo', 'a123456', '悠悠哒', '13552455654', '', NULL, NULL, 0, '2026-03-17 21:44:01.744229', '2026-03-29 14:46:54.000000', 1, 0, '', 7);

-- ----------------------------
-- Table structure for sys_admin_roles
-- ----------------------------
DROP TABLE IF EXISTS `sys_admin_roles`;
CREATE TABLE `sys_admin_roles`  (
  `admin_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  PRIMARY KEY (`admin_id`, `role_id`) USING BTREE,
  INDEX `IDX_18cdc9b348abeb0241c2f4a5d0`(`admin_id`) USING BTREE,
  INDEX `IDX_10c43217a9477c032315092cdb`(`role_id`) USING BTREE,
  CONSTRAINT `FK_10c43217a9477c032315092cdbc` FOREIGN KEY (`role_id`) REFERENCES `sys_role` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_18cdc9b348abeb0241c2f4a5d05` FOREIGN KEY (`admin_id`) REFERENCES `sys_admin` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_admin_roles
-- ----------------------------
INSERT INTO `sys_admin_roles` VALUES (1, 1);
INSERT INTO `sys_admin_roles` VALUES (2, 2);

-- ----------------------------
-- Table structure for sys_code_field_config
-- ----------------------------
DROP TABLE IF EXISTS `sys_code_field_config`;
CREATE TABLE `sys_code_field_config`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `field_name` varchar(100) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '字段名',
  `db_type` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '数据库类型',
  `ts_type` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT 'TypeScript类型',
  `field_length` int(11) NULL DEFAULT NULL COMMENT '字段长度',
  `field_comment` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '字段注释',
  `is_nullable` tinyint(4) NOT NULL DEFAULT 0 COMMENT '是否可空',
  `is_unique` tinyint(4) NOT NULL DEFAULT 0 COMMENT '是否唯一',
  `default_value` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '默认值',
  `is_insert` tinyint(4) NOT NULL DEFAULT 1 COMMENT '是否插入字段',
  `is_update` tinyint(4) NOT NULL DEFAULT 1 COMMENT '是否更新字段',
  `is_list` tinyint(4) NOT NULL DEFAULT 1 COMMENT '是否列表显示',
  `is_query` tinyint(4) NOT NULL DEFAULT 0 COMMENT '是否查询字段',
  `query_operator` varchar(20) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '=' COMMENT '查询操作符',
  `query_component` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT 'input' COMMENT '查询组件',
  `form_component` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT 'input' COMMENT '表单组件',
  `dict_code` varchar(100) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '字典编码',
  `sort_order` int(11) NOT NULL DEFAULT 0 COMMENT '排序',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `table_id` int(11) NULL DEFAULT NULL,
  `is_multi_select` tinyint(4) NOT NULL DEFAULT 0 COMMENT '是否多选（表单/查询值为数组；查询用 IN；常用于 select 多选，或与 checkbox 查询一致）',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `FK_42d24fd755d14462d7c01aecbe5`(`table_id`) USING BTREE,
  CONSTRAINT `FK_42d24fd755d14462d7c01aecbe5` FOREIGN KEY (`table_id`) REFERENCES `sys_code_table_config` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE = InnoDB AUTO_INCREMENT = 106 CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_code_field_config
-- ----------------------------
INSERT INTO `sys_code_field_config` VALUES (91, 'id', 'int', 'number', NULL, NULL, 0, 0, NULL, 0, 1, 1, 0, '=', 'input', 'input', NULL, 0, '2026-03-24 13:25:21.108263', '2026-03-24 13:25:21.108263', 1, 0);
INSERT INTO `sys_code_field_config` VALUES (92, 'username', 'varchar', 'string', 255, '用户名', 0, 0, NULL, 1, 1, 1, 1, '=', 'select', 'input', 'sys_message_status', 1, '2026-03-24 13:25:21.114507', '2026-03-24 13:25:21.114507', 1, 0);
INSERT INTO `sys_code_field_config` VALUES (93, 'password', 'varchar', 'string', 255, '密码哈希', 0, 0, NULL, 1, 1, 1, 1, '=', 'input', 'input', NULL, 2, '2026-03-24 13:25:21.117713', '2026-03-24 13:25:21.117713', 1, 0);
INSERT INTO `sys_code_field_config` VALUES (94, 'nickname', 'varchar', 'string', 255, '昵称', 0, 0, NULL, 1, 1, 1, 0, '=', 'input', 'input', NULL, 3, '2026-03-24 13:25:21.122174', '2026-03-24 13:25:21.122174', 1, 0);
INSERT INTO `sys_code_field_config` VALUES (95, 'phone', 'varchar', 'string', 255, '手机号码', 0, 0, NULL, 1, 1, 1, 0, '=', 'input', 'input', NULL, 4, '2026-03-24 13:25:21.125102', '2026-03-24 13:25:21.125102', 1, 0);
INSERT INTO `sys_code_field_config` VALUES (96, 'email', 'varchar', 'string', 255, '电子邮箱', 0, 0, NULL, 1, 1, 1, 0, '=', 'input', 'input', NULL, 5, '2026-03-24 13:25:21.128165', '2026-03-24 13:25:21.128165', 1, 0);
INSERT INTO `sys_code_field_config` VALUES (97, 'lastLoginAt', 'datetime', 'string', NULL, '最后登录时间', 0, 0, NULL, 0, 0, 1, 1, 'between', 'date', 'input', NULL, 6, '2026-03-24 13:25:21.131589', '2026-03-24 13:25:21.131589', 1, 0);
INSERT INTO `sys_code_field_config` VALUES (98, 'lastLoginIp', 'varchar', 'string', 255, '最后登录IP', 0, 0, NULL, 1, 1, 1, 0, '=', 'input', 'input', NULL, 7, '2026-03-24 13:25:21.134402', '2026-03-24 13:25:21.134402', 1, 0);
INSERT INTO `sys_code_field_config` VALUES (99, 'isSuperAdmin', 'tinyint', 'number', NULL, '是否超级管理员', 0, 0, NULL, 1, 1, 1, 0, '=', 'input', 'input', NULL, 8, '2026-03-24 13:25:21.137830', '2026-03-24 13:25:21.137830', 1, 0);
INSERT INTO `sys_code_field_config` VALUES (100, 'createdAt', 'datetime', 'string', NULL, '创建时间', 0, 0, NULL, 1, 1, 1, 0, '=', 'input', 'input', NULL, 9, '2026-03-24 13:25:21.142549', '2026-03-24 13:25:21.142549', 1, 0);
INSERT INTO `sys_code_field_config` VALUES (101, 'updatedAt', 'datetime', 'string', NULL, '更新时间', 0, 0, NULL, 1, 1, 1, 0, '=', 'input', 'input', NULL, 10, '2026-03-24 13:25:21.145163', '2026-03-24 13:25:21.145163', 1, 0);
INSERT INTO `sys_code_field_config` VALUES (102, 'avatar', 'varchar', 'string', 255, '头像', 0, 0, NULL, 1, 1, 1, 0, '=', 'input', 'input', NULL, 11, '2026-03-24 13:25:21.148581', '2026-03-24 13:25:21.148581', 1, 0);
INSERT INTO `sys_code_field_config` VALUES (103, 'status', 'tinyint', 'number', NULL, '用户状态 0:禁用 1:正常', 0, 0, NULL, 1, 1, 1, 0, '=', 'input', 'input', NULL, 12, '2026-03-24 13:25:21.152109', '2026-03-24 13:25:21.152109', 1, 0);
INSERT INTO `sys_code_field_config` VALUES (104, 'sex', 'int', 'number', NULL, '性别 1:女 0:男', 0, 0, NULL, 1, 1, 1, 0, '=', 'input', 'input', NULL, 13, '2026-03-24 13:25:21.154496', '2026-03-24 13:25:21.154496', 1, 0);
INSERT INTO `sys_code_field_config` VALUES (105, 'remark', 'varchar', 'string', 255, '用户备注', 0, 0, NULL, 1, 1, 1, 0, '=', 'input', 'input', NULL, 14, '2026-03-24 13:25:21.157641', '2026-03-24 13:25:21.157641', 1, 0);

-- ----------------------------
-- Table structure for sys_code_table_config
-- ----------------------------
DROP TABLE IF EXISTS `sys_code_table_config`;
CREATE TABLE `sys_code_table_config`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `table_name` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '表名',
  `table_comment` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '表注释',
  `class_name` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '实体类名',
  `module_name` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '所属模块名',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `template_name` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '模版名称',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `IDX_d3039d344f7825ec5db37edfd8`(`table_name`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_code_table_config
-- ----------------------------
INSERT INTO `sys_code_table_config` VALUES (1, 'sys_admin', '管理员表', 'SysAdmin', 'system/admin', '2026-03-24 10:33:19.970155', '2026-03-24 10:33:19.970155', '');

-- ----------------------------
-- Table structure for sys_dict
-- ----------------------------
DROP TABLE IF EXISTS `sys_dict`;
CREATE TABLE `sys_dict`  (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键id',
  `code` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '字典编码',
  `name` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '字典名称',
  `description` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '字典描述',
  `status` tinyint(4) NOT NULL DEFAULT 1 COMMENT '字典状态 0:禁用 1:启用',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `IDX_20870e7cf976aa11cde42bf1ae`(`code`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 16 CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_dict
-- ----------------------------
INSERT INTO `sys_dict` VALUES (12, 'sys_message_type', '系统消息类型', '', 1, '2026-03-23 01:26:25.244289');
INSERT INTO `sys_dict` VALUES (13, 'sys_message_status', '系统消息状态', '', 1, '2026-03-23 01:26:40.823531');
INSERT INTO `sys_dict` VALUES (14, 'sys_file_module', '系统文件模块', '系统文件管理的模块类型', 1, '2026-03-26 22:51:56.637327');
INSERT INTO `sys_dict` VALUES (15, 'sys_file_type', '系统文件类型', '', 1, '2026-03-26 23:02:17.046873');

-- ----------------------------
-- Table structure for sys_dict_data
-- ----------------------------
DROP TABLE IF EXISTS `sys_dict_data`;
CREATE TABLE `sys_dict_data`  (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键id',
  `name` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '字典名称',
  `value` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '字典值（同一 parentId 下唯一，不同 parentId 可相同）',
  `description` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '字典描述',
  `sort` int(11) NOT NULL DEFAULT 0 COMMENT '字典排序',
  `status` tinyint(4) NOT NULL DEFAULT 1 COMMENT '字典状态 0:禁用 1:启用',
  `updatedBy` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '更新者',
  `createdBy` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '创建者',
  `updatedAt` datetime NULL DEFAULT NULL COMMENT '更新时间',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `parentId` int(11) NOT NULL COMMENT '父亲级Id',
  `dictId` int(11) NULL DEFAULT NULL COMMENT '嵌套字典id',
  `tagType` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT 'default' COMMENT '标签类型',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `UQ_sys_dict_data_parentId_value`(`parentId`, `value`) USING BTREE,
  INDEX `IDX_299686605f5060fc0604174e1f`(`parentId`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 29 CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_dict_data
-- ----------------------------
INSERT INTO `sys_dict_data` VALUES (11, '已读', '1', '', 0, 1, NULL, NULL, NULL, '2026-03-23 01:27:14.569805', 13, NULL, 'default');
INSERT INTO `sys_dict_data` VALUES (12, '未读', '0', '', 0, 1, NULL, NULL, NULL, '2026-03-23 01:27:24.862517', 13, NULL, 'default');
INSERT INTO `sys_dict_data` VALUES (15, '通知', '1', '', 0, 1, NULL, NULL, NULL, '2026-03-23 01:32:32.850482', 12, NULL, 'warning_light');
INSERT INTO `sys_dict_data` VALUES (16, '消息', '2', '', 0, 1, NULL, NULL, NULL, '2026-03-23 01:32:42.189063', 12, NULL, 'info_light');
INSERT INTO `sys_dict_data` VALUES (18, '管理人员头像', 'admin_user_avatar', '', 0, 1, NULL, NULL, NULL, '2026-03-26 22:56:16.158440', 14, NULL, 'warning_light');
INSERT INTO `sys_dict_data` VALUES (19, '图片(png)', 'png', '', 0, 1, NULL, NULL, NULL, '2026-03-26 23:02:39.379520', 15, NULL, 'default');
INSERT INTO `sys_dict_data` VALUES (20, '图片(jpg)', 'jpg', '', 0, 1, NULL, NULL, NULL, '2026-03-26 23:02:48.719533', 15, NULL, 'default');
INSERT INTO `sys_dict_data` VALUES (21, '视频(mp4)', 'mp4', '', 0, 1, NULL, NULL, NULL, '2026-03-26 23:03:00.088220', 15, NULL, 'default');
INSERT INTO `sys_dict_data` VALUES (22, '音频(mp3)', 'mp3', '', 0, 1, NULL, NULL, NULL, '2026-03-26 23:03:09.559793', 15, NULL, 'default');
INSERT INTO `sys_dict_data` VALUES (23, '音频(wav)', 'wav', '', 0, 1, NULL, NULL, NULL, '2026-03-26 23:03:16.623210', 15, NULL, 'default');
INSERT INTO `sys_dict_data` VALUES (24, '压缩包(zip)', 'zip', '', 0, 1, NULL, NULL, NULL, '2026-03-26 23:03:37.135255', 15, NULL, 'default');
INSERT INTO `sys_dict_data` VALUES (25, '压缩包(7z)', '7z', '', 0, 1, NULL, NULL, NULL, '2026-03-26 23:03:47.208649', 15, NULL, 'default');
INSERT INTO `sys_dict_data` VALUES (26, '其他图片', 'other_img', '', 0, 1, NULL, NULL, NULL, '2026-03-26 23:07:48.664230', 14, NULL, 'default');
INSERT INTO `sys_dict_data` VALUES (27, '其他视频', 'other_video', '', 0, 1, NULL, NULL, NULL, '2026-03-26 23:08:12.259981', 14, NULL, 'default');
INSERT INTO `sys_dict_data` VALUES (28, '其他文件', 'other_file', '', 0, 1, NULL, NULL, NULL, '2026-03-27 09:50:49.806499', 14, NULL, 'default');

-- ----------------------------
-- Table structure for sys_file
-- ----------------------------
DROP TABLE IF EXISTS `sys_file`;
CREATE TABLE `sys_file`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fileName` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '文件名',
  `filePath` varchar(500) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '文件路径',
  `fileType` varchar(100) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '文件类型/扩展名',
  `fileSize` bigint(20) NOT NULL COMMENT '文件大小(字节)',
  `fileHash` varchar(100) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '文件哈希值',
  `uploadUserId` int(11) NULL DEFAULT NULL COMMENT '上传用户ID',
  `uploadUserName` varchar(100) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '上传用户名称',
  `module` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '业务模块标识 用于分组',
  `isActive` tinyint(4) NOT NULL DEFAULT 1 COMMENT '是否有效(软删除)',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) NULL DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 8 CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_file
-- ----------------------------
INSERT INTO `sys_file` VALUES (1, 'NestAdminXo.png', '/uploads/2026/03/26/4fd8af7bd8669122a5425e001b2e5f55.png', 'png', 164623, '4fd8af7bd8669122a5425e001b2e5f55', NULL, NULL, 'admin_user_avatar', 0, '2026-03-26 22:59:22.239318', '2026-03-28 23:40:46.000000', '2026-03-28 23:40:46.453000');
INSERT INTO `sys_file` VALUES (2, 'mda-pc5afsea17fqtidj.mp4', '/uploads/2026/03/26/fb7e66a371abdd29c17c0892e4b2c10b.mp4', 'mp4', 7326237, 'fb7e66a371abdd29c17c0892e4b2c10b', NULL, NULL, 'other_video', 0, '2026-03-26 23:08:52.087016', '2026-03-28 23:40:15.000000', '2026-03-28 23:40:15.914000');
INSERT INTO `sys_file` VALUES (4, 'avatar_2.png', '/uploads/2026/03/27/da6157ed3fe6f1a8d9535bdab7345678.png', 'png', 210300, 'da6157ed3fe6f1a8d9535bdab7345678', NULL, NULL, 'admin_user_avatar', 1, '2026-03-27 00:03:17.417534', '2026-03-27 00:03:17.417534', NULL);
INSERT INTO `sys_file` VALUES (5, 'hx.png', '/uploads/2026/03/27/1a45a1eb328c7e6e12905631fde1a366.png', 'png', 124570, '1a45a1eb328c7e6e12905631fde1a366', NULL, NULL, 'other_img', 0, '2026-03-27 00:09:02.727789', '2026-03-28 23:40:24.000000', '2026-03-28 23:40:24.365000');
INSERT INTO `sys_file` VALUES (7, 'avatar_2.png', '/uploads/2026/03/27/7682d33c3ad0edc7e9fe6e48c7e521c5.png', 'png', 477876, '7682d33c3ad0edc7e9fe6e48c7e521c5', NULL, NULL, 'admin_user_avatar', 1, '2026-03-27 00:21:44.520577', '2026-03-27 00:21:44.520577', NULL);

-- ----------------------------
-- Table structure for sys_menu
-- ----------------------------
DROP TABLE IF EXISTS `sys_menu`;
CREATE TABLE `sys_menu`  (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `parentId` int(11) NOT NULL DEFAULT 0 COMMENT '父级菜单ID，0表示根菜单',
  `menuType` int(11) NOT NULL COMMENT '菜单类型：0=菜单 1=iframe 2=外链 3=按钮',
  `title` varchar(100) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '菜单标题（支持国际化key）',
  `name` varchar(100) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '路由名称',
  `path` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '路由路径',
  `component` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '组件路径',
  `rank` int(11) NULL DEFAULT NULL COMMENT '排序（数字越小越靠前）',
  `redirect` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '重定向路径',
  `icon` varchar(100) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '菜单图标',
  `extraIcon` varchar(100) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '额外图标',
  `enterTransition` varchar(100) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '进入页面动画',
  `leaveTransition` varchar(100) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '离开页面动画',
  `activePath` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '激活菜单路径',
  `frameSrc` varchar(500) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT 'iframe地址（menuType=1时有效）',
  `frameLoading` tinyint(4) NOT NULL DEFAULT 1 COMMENT 'iframe加载状态',
  `keepAlive` tinyint(4) NOT NULL DEFAULT 0 COMMENT '是否缓存（keep-alive）',
  `hiddenTag` tinyint(4) NOT NULL DEFAULT 0 COMMENT '是否隐藏标签页',
  `fixedTag` tinyint(4) NOT NULL DEFAULT 0 COMMENT '是否固定标签页',
  `showLink` tinyint(4) NOT NULL DEFAULT 1 COMMENT '是否显示菜单',
  `showParent` tinyint(4) NOT NULL DEFAULT 0 COMMENT '是否显示父级菜单',
  `auths` varchar(500) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '按钮级别权限标识',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 68 CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_menu
-- ----------------------------
INSERT INTO `sys_menu` VALUES (1, 0, 0, '系统管理', 'System', '/system', '', 99, '', 'ri:settings-3-fill', '', '', '', '', '', 1, 0, 0, 0, 1, 0, '');
INSERT INTO `sys_menu` VALUES (2, 1, 0, '菜单管理', 'SystemMenu', 'menu', 'system/menu/index', 99, '', 'ep:menu', '', '', '', '', '', 1, 1, 0, 0, 1, 1, '');
INSERT INTO `sys_menu` VALUES (10, 1, 0, '字典管理', 'SystemDict', 'dict', 'system/dict/index', 2, '', 'ri:book-3-fill', '', '', '', '', '', 1, 1, 0, 0, 1, 1, '');
INSERT INTO `sys_menu` VALUES (11, 1, 0, '管理人员', 'SystemUser', 'user', 'system/user/index', 1, '', 'ri:folder-user-fill', '', '', '', '', '', 1, 1, 0, 0, 1, 1, '');
INSERT INTO `sys_menu` VALUES (16, 2, 3, '新增', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'menu:btn:add');
INSERT INTO `sys_menu` VALUES (18, 2, 3, '修改', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'menu:btn:update');
INSERT INTO `sys_menu` VALUES (19, 2, 3, '删除', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'menu:btn:delete');
INSERT INTO `sys_menu` VALUES (20, 1, 0, '角色管理', 'SystemRole', 'role', 'system/role/index', 3, '', 'ri:user-settings-fill', '', '', '', '', '', 1, 1, 0, 0, 1, 0, '');
INSERT INTO `sys_menu` VALUES (23, 23, 0, '管理列表', 'Campus', '/list', 'campus/index', 1, '', 'fa-solid:address-book', '', '', '', '', '', 1, 1, 0, 0, 1, 0, '');
INSERT INTO `sys_menu` VALUES (26, 0, 0, '系统工具', 'SystemTools', '/system-tools', '', 99, '', 'ri:tools-fill', '', '', '', '', '', 1, 0, 0, 0, 1, 0, '');
INSERT INTO `sys_menu` VALUES (27, 26, 1, '表单生成', 'FormBuilder', '/form-builder', '', 99, '', 'lets-icons:form', '', '', '', '', 'http://120.92.142.115:81/vform3pro/', 1, 1, 0, 0, 1, 1, '');
INSERT INTO `sys_menu` VALUES (28, 26, 1, 'PPT', 'Ppt', '/ppt', '', 99, '', 'ri:file-ppt-2-fill', '', '', '', '', 'https://pipipi-pikachu.github.io/PPTist/', 1, 1, 0, 0, 1, 1, '');
INSERT INTO `sys_menu` VALUES (29, 26, 0, '实体类生成', 'SystemGeneratorEntity', '/generator-entity', 'system/generator/entity', 99, '', 'ri:table-2', '', '', '', '', '', 1, 1, 0, 0, 1, 1, '');
INSERT INTO `sys_menu` VALUES (30, 1, 0, '消息管理', 'SystemMessage', 'message', 'system/message/index', 4, '', 'ri:message-3-fill', '', '', '', '', '', 1, 1, 0, 0, 1, 1, '');
INSERT INTO `sys_menu` VALUES (31, 26, 0, '代码生成', 'SystemGeneratorIndex', '/system-generator', 'system/generator/index', 99, '', 'ri:code-box-line', '', '', '', '', '', 1, 1, 0, 0, 1, 1, '');
INSERT INTO `sys_menu` VALUES (32, 2, 3, '查看', '', '', '', 98, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'menu:list');
INSERT INTO `sys_menu` VALUES (33, 10, 3, '查看', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'dict:list');
INSERT INTO `sys_menu` VALUES (34, 10, 3, '新增', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'dict:btn:add');
INSERT INTO `sys_menu` VALUES (35, 10, 3, '修改', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'dict:btn:update');
INSERT INTO `sys_menu` VALUES (36, 10, 3, '删除', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'dict:btn:delete');
INSERT INTO `sys_menu` VALUES (37, 1, 0, '计划任务', 'SystemTasks', 'tasks', 'system/tasks/index', 5, '', 'svg-spinners:clock', '', '', '', '', '', 1, 1, 0, 0, 1, 1, '');
INSERT INTO `sys_menu` VALUES (38, 1, 0, '文件管理', 'SystemFile', 'file', 'system/file/index', 6, '', 'lets-icons:folder-file-alt-duotone-fill', '', '', '', '', '', 1, 1, 0, 0, 1, 1, '');
INSERT INTO `sys_menu` VALUES (39, 0, 0, '系统监控', 'monitoring', '/monitoring', '', 99, '', 'line-md:monitor-screenshot-twotone', '', '', '', '', '', 1, 1, 0, 0, 1, 1, '');
INSERT INTO `sys_menu` VALUES (40, 39, 0, '在线用户', 'OnlineUser', 'onlineUser', 'system/user/onlineUser', 99, '', 'ri:user-search-fill', '', '', '', '', '', 1, 1, 0, 0, 1, 1, '');
INSERT INTO `sys_menu` VALUES (41, 11, 3, '查看', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'user:list');
INSERT INTO `sys_menu` VALUES (42, 11, 3, '添加', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'user:btn:add');
INSERT INTO `sys_menu` VALUES (43, 11, 3, '修改', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'user:btn:update');
INSERT INTO `sys_menu` VALUES (44, 11, 3, '删除', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'user:btn:delete');
INSERT INTO `sys_menu` VALUES (45, 11, 3, '分配角色', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'user:btn:assignRole');
INSERT INTO `sys_menu` VALUES (46, 11, 3, '修改密码', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'user:btn:resetPassword');
INSERT INTO `sys_menu` VALUES (47, 40, 3, '查看', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'user:online:list');
INSERT INTO `sys_menu` VALUES (48, 40, 3, '删除', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'user:online:delete');
INSERT INTO `sys_menu` VALUES (49, 20, 3, '查看', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'role:list');
INSERT INTO `sys_menu` VALUES (50, 20, 3, '新增', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'role:btn:add');
INSERT INTO `sys_menu` VALUES (51, 20, 3, '修改', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'role:btn:update');
INSERT INTO `sys_menu` VALUES (52, 20, 3, '删除', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'role:btn:delete');
INSERT INTO `sys_menu` VALUES (53, 38, 3, '查看', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'file:list');
INSERT INTO `sys_menu` VALUES (54, 38, 3, '上传', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'file:btn:upload');
INSERT INTO `sys_menu` VALUES (55, 38, 3, '删除', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'file:btn:delete');
INSERT INTO `sys_menu` VALUES (56, 37, 3, '查看', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'tasks:list');
INSERT INTO `sys_menu` VALUES (57, 37, 3, '执行', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'tasks:btn:execute');
INSERT INTO `sys_menu` VALUES (58, 37, 3, '更新', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'tasks:btn:update');
INSERT INTO `sys_menu` VALUES (59, 37, 3, '删除', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'tasks:btn:delete');
INSERT INTO `sys_menu` VALUES (60, 30, 3, '查看', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'message:list');
INSERT INTO `sys_menu` VALUES (61, 30, 3, '新增', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'message:btn:add');
INSERT INTO `sys_menu` VALUES (62, 30, 3, '修改', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'message:btn:update');
INSERT INTO `sys_menu` VALUES (63, 30, 3, '删除', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'message:btn:delete');
INSERT INTO `sys_menu` VALUES (64, 31, 3, '查看', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'generator:list');
INSERT INTO `sys_menu` VALUES (65, 31, 3, '保存', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'generator:btn:save');
INSERT INTO `sys_menu` VALUES (66, 31, 3, '预览/生成', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'generator:btn:generate');
INSERT INTO `sys_menu` VALUES (67, 29, 3, '生成', '', '', '', 99, '', '', '', '', '', '', '', 1, 0, 0, 0, 1, 0, 'generate:typeorm:generate');

-- ----------------------------
-- Table structure for sys_message
-- ----------------------------
DROP TABLE IF EXISTS `sys_message`;
CREATE TABLE `sys_message`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '关联 sys_admin 表的 id',
  `type` int(11) NOT NULL COMMENT '消息类型：1-通知、2-消息',
  `status` tinyint(4) NOT NULL COMMENT '状态：false-未读、true-已读',
  `title` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '消息标题',
  `content` text CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '消息内容',
  `redirect_url` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '点击跳转路径',
  `read_at` datetime NULL DEFAULT NULL COMMENT '已读时间',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '发送时间',
  `deleted_at` datetime(6) NULL DEFAULT NULL,
  `send_batch_id` varchar(36) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '同一次发送批次 ID（UUID）',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_message
-- ----------------------------
INSERT INTO `sys_message` VALUES (1, 1, 1, 1, '标题', '内容', NULL, '2026-03-23 01:39:31', '2026-03-23 01:34:38.674710', '2026-03-23 01:46:23.000000', '5ee5e716-3d78-4b78-8720-af4be52fcdae');
INSERT INTO `sys_message` VALUES (2, 2, 1, 0, '标题', '内容', NULL, NULL, '2026-03-23 01:34:38.680626', '2026-03-23 01:46:25.000000', '5ee5e716-3d78-4b78-8720-af4be52fcdae');
INSERT INTO `sys_message` VALUES (3, 1, 1, 1, '标题测试', '<p><strong>内容萨达萨达萨萨大厦</strong></p><p><span style=\"color: rgb(225, 60, 57); font-size: 22px;\"><strong>啥的啥的sad啊8888</strong></span></p>', NULL, '2026-03-23 01:47:05', '2026-03-23 01:46:50.436707', NULL, 'e9b7a958-39ad-46b3-8363-eaf73d3a083d');
INSERT INTO `sys_message` VALUES (4, 2, 1, 1, '标题测试', '<p><strong>内容萨达萨达萨萨大厦</strong></p><p><span style=\"color: rgb(225, 60, 57); font-size: 22px;\"><strong>啥的啥的sad啊</strong></span></p>', NULL, '2026-03-29 12:20:06', '2026-03-23 01:46:50.442058', NULL, 'e9b7a958-39ad-46b3-8363-eaf73d3a083d');
INSERT INTO `sys_message` VALUES (5, 1, 1, 1, '测试跳转', '<p>222222</p>', '/monitoring?yoyo=666', '2026-03-29 13:07:29', '2026-03-29 13:07:19.230861', NULL, '2b3c389e-dbc1-41a8-86c0-b002d006947d');

-- ----------------------------
-- Table structure for sys_role
-- ----------------------------
DROP TABLE IF EXISTS `sys_role`;
CREATE TABLE `sys_role`  (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '角色编号',
  `name` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '角色名称',
  `code` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '角色标识（程序中使用）',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `remark` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '角色描述',
  `createdBy` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '创建人',
  `updatedBy` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '更新人',
  `status` tinyint(4) NOT NULL DEFAULT 1 COMMENT '角色状态 0:禁用 1:启用',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `IDX_223de54d6badbe43a5490450c3`(`name`) USING BTREE,
  UNIQUE INDEX `IDX_cf51756dc07761fea6b351e061`(`code`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_role
-- ----------------------------
INSERT INTO `sys_role` VALUES (1, '管理员', 'admin', '2026-03-13 23:54:25.197101', '2026-03-16 23:54:56.675570', '最高级别的系统管理员', '', '', 1);
INSERT INTO `sys_role` VALUES (2, '财务', 'finance', '2026-03-16 13:35:41.549806', '2026-03-29 20:23:42.000000', '财务', '', '', 1);

-- ----------------------------
-- Table structure for sys_role_menu
-- ----------------------------
DROP TABLE IF EXISTS `sys_role_menu`;
CREATE TABLE `sys_role_menu`  (
  `roleId` int(11) NOT NULL COMMENT '角色ID',
  `menuId` int(11) NOT NULL COMMENT '菜单ID',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '授权时间',
  PRIMARY KEY (`roleId`, `menuId`) USING BTREE,
  UNIQUE INDEX `IDX_8569c03c9701d1744232ead257`(`roleId`, `menuId`) USING BTREE,
  INDEX `FK_7e0fc887979c9dee7a3dbed7eb5`(`menuId`) USING BTREE,
  CONSTRAINT `FK_7e0fc887979c9dee7a3dbed7eb5` FOREIGN KEY (`menuId`) REFERENCES `sys_menu` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `FK_bdd82e5f4c2bedda41f89b69ba3` FOREIGN KEY (`roleId`) REFERENCES `sys_role` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE = InnoDB CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_role_menu
-- ----------------------------
INSERT INTO `sys_role_menu` VALUES (1, 20, '2026-03-16 23:43:40.262546');
INSERT INTO `sys_role_menu` VALUES (2, 1, '2026-03-29 20:25:05.938422');
INSERT INTO `sys_role_menu` VALUES (2, 10, '2026-03-29 20:25:05.938422');
INSERT INTO `sys_role_menu` VALUES (2, 11, '2026-03-29 20:25:05.938422');
INSERT INTO `sys_role_menu` VALUES (2, 20, '2026-03-29 20:25:05.938422');
INSERT INTO `sys_role_menu` VALUES (2, 30, '2026-03-29 20:25:05.938422');
INSERT INTO `sys_role_menu` VALUES (2, 33, '2026-03-29 20:25:05.938422');
INSERT INTO `sys_role_menu` VALUES (2, 37, '2026-03-29 20:25:05.938422');
INSERT INTO `sys_role_menu` VALUES (2, 38, '2026-03-29 20:25:05.938422');
INSERT INTO `sys_role_menu` VALUES (2, 40, '2026-03-29 20:25:05.938422');
INSERT INTO `sys_role_menu` VALUES (2, 41, '2026-03-29 20:25:05.938422');
INSERT INTO `sys_role_menu` VALUES (2, 47, '2026-03-29 20:25:05.938422');
INSERT INTO `sys_role_menu` VALUES (2, 49, '2026-03-29 20:25:05.938422');
INSERT INTO `sys_role_menu` VALUES (2, 53, '2026-03-29 20:25:05.938422');
INSERT INTO `sys_role_menu` VALUES (2, 56, '2026-03-29 20:25:05.938422');
INSERT INTO `sys_role_menu` VALUES (2, 60, '2026-03-29 20:25:05.938422');

-- ----------------------------
-- Table structure for sys_task
-- ----------------------------
DROP TABLE IF EXISTS `sys_task`;
CREATE TABLE `sys_task`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '任务名称',
  `description` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '任务描述',
  `cron` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT 'cron表达式',
  `params` json NULL COMMENT '任务参数',
  `enabled` tinyint(4) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `last_execute_time` datetime NULL DEFAULT NULL COMMENT '上次执行时间',
  `is_manual_execute` tinyint(4) NOT NULL DEFAULT 0 COMMENT '上次执行是手动执行？',
  `last_execute_status` tinyint(4) NOT NULL DEFAULT 2 COMMENT '上次执行状态 0:失败 1:成功 2:未执行',
  `task_type` varchar(20) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT 'cron' COMMENT '任务类型',
  `is_valid` tinyint(4) NOT NULL DEFAULT 0 COMMENT '任务是否有效',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 8 CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_task
-- ----------------------------
INSERT INTO `sys_task` VALUES (1, '测试任务', '就是一个测试任务而已', '0 34 8 * * 3', NULL, 0, '2026-03-26 10:30:54', 1, 1, 'cron', 1, '2026-03-25 22:55:12.414536', '2026-03-29 20:34:30.000000');
INSERT INTO `sys_task` VALUES (6, 'sys_清理已软删除超过24小时的文件数据', '', '0 0 3 * * *', NULL, 1, '2026-03-29 12:13:57', 1, 1, 'cron', 1, '2026-03-26 23:37:31.655170', '2026-03-29 20:34:30.000000');
INSERT INTO `sys_task` VALUES (7, 'sys_清理已软删除超过6小时未完成的分片目录', 'sys_清理已软删除超过6小时未完成的分片目录', '0 0 */2 * * *', NULL, 1, '2026-03-29 20:00:00', 0, 1, 'cron', 1, '2026-03-26 23:39:27.172899', '2026-03-29 20:34:30.000000');

SET FOREIGN_KEY_CHECKS = 1;
