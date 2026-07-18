import { createZodDto } from 'nestjs-zod';
import { CreateMenuSchema } from '../dto/create-menu.dto';
import z from 'zod';
import de from 'zod/v4/locales/de.js';

const MenuSchema = CreateMenuSchema.extend({
  id: z.number().int().min(1, '菜单ID必须为正整数'),
});

class MenuDto extends createZodDto(MenuSchema) {}

// 定义类型接口
interface CustomizeRouteMeta {
  title: string;
  icon?: string;
  extraIcon?: string;
  showLink?: boolean;
  showParent?: boolean;
  roles?: string[];
  auths?: string[];
  keepAlive?: boolean;
  frameSrc?: string;
  frameLoading?: boolean;
  rank?: number; // 只有顶级菜单有这个  子菜单返回 前端会出现找不到页面
  transition?: {
    name?: string;
    enterTransition?: string;
    leaveTransition?: string;
  };
  hiddenTag?: boolean;
  fixedTag?: boolean;
  dynamicLevel?: number;
  activePath?: string;
  loaded?: boolean;
  backstage?: boolean;
}

interface RouteChildrenConfigsTable {
  path?: string;
  name?: string;
  redirect?: string;
  component?: string;
  meta: CustomizeRouteMeta;
  children?: RouteChildrenConfigsTable[];
}

/**
 * 将扁平菜单数据转换为 Pure Admin 路由格式
 * 严格按照文档中的动态路由规范
 * @param flatMenus 扁平菜单数组
 * @returns 符合Pure Admin动态路由格式的路由数组
 */
export function convertToPureRoutes(
  flatMenus: MenuDto[],
): RouteChildrenConfigsTable[] {
  const routes: RouteChildrenConfigsTable[] = [];
  // 根据id创建映射表方便获取父级菜单
  const routeMaps = new Map<
    number,
    { pid: number; data: RouteChildrenConfigsTable }
  >();
  const btnMenus: { pid: number; auths: string }[] = [];

  for (const menu of flatMenus) {
    // 菜单类型：0=菜单 1=iframe 2=外链 3=按钮
    if (menu.menuType === 0 || menu.menuType === 2) {
      const route: RouteChildrenConfigsTable = {
        path: menu.path as string,
        name: menu.name,
        meta: {
          title: menu.title,
          icon: menu.icon,
          keepAlive: Boolean(menu.keepAlive),
          hiddenTag: menu.hiddenTag,
          fixedTag: menu.fixedTag,
          auths: [],
          transition: {},
          backstage: true,
        },
      };
      if (!menu.parentId) route.meta['rank'] = menu.rank; // 顶级菜单添加rank
      isValueAddValue(route, menu.component, 'component');
      route.meta.showLink = Boolean(menu.showLink);
      isValueAddValue(route.meta, menu.activePath, 'activePath');
      isValueAddValue(route.meta, menu.showParent, 'showParent');
      isValueAddValue(
        route.meta.transition,
        menu.enterTransition,
        'enterTransition',
      );
      isValueAddValue(
        route.meta.transition,
        menu.leaveTransition,
        'leaveTransition',
      );
      // 如果当前路由没有component，就需要移除name 属性 因为这个属于目录
      if (!route.component) delete route.name;
      routeMaps.set(menu.id, { pid: menu.parentId, data: route });
      continue;
    }
    if (menu.menuType === 1) {
      const route: RouteChildrenConfigsTable = {
        path: menu.path as string,
        name: menu.name,
        meta: {
          title: menu.title,
          icon: menu.icon,
          keepAlive: Boolean(menu.keepAlive),
          hiddenTag: menu.hiddenTag,
          fixedTag: menu.fixedTag,
          frameSrc: menu.frameSrc,
          frameLoading: menu.frameLoading,
          auths: [],
          transition: {},
          backstage: true,
        },
      };
      if (!menu.parentId) route.meta['rank'] = menu.rank; // 顶级菜单添加rank
      isValueAddValue(route, menu.component, 'component');
      route.meta.showLink = Boolean(menu.showLink);
      isValueAddValue(route.meta, menu.activePath, 'activePath');
      isValueAddValue(route.meta, menu.showParent, 'showParent');
      isValueAddValue(
        route.meta.transition,
        menu.enterTransition,
        'enterTransition',
      );
      isValueAddValue(
        route.meta.transition,
        menu.leaveTransition,
        'leaveTransition',
      );
      routeMaps.set(menu.id, { pid: menu.parentId, data: route });
      continue;
    }
    // 3=按钮 是没有 path 和 name 的

    if (menu.menuType === 3) {
      btnMenus.push({ pid: menu.parentId, auths: menu.auths as string });
      continue;
    }
  }
  // 先将按钮的添加进父节点的auths中
  for (const btnMenu of btnMenus) {
    const route = routeMaps.get(btnMenu.pid);
    if (route) {
      route.data.meta.auths?.push(btnMenu.auths);
    }
  }

  // ##1再将菜单和父节点拼接,如果父布局没有component那么就需要将redirect改成子节点的第一个path,并且子节点的path都需要拼接父节点的path，最终都添加进routes数组

  // 1. 先找出所有顶级菜单（parentId = 0）
  const rootRoutes: RouteChildrenConfigsTable[] = [];
  const menuEntries = Array.from(routeMaps.entries());

  for (const [_id, routeInfo] of menuEntries) {
    if (routeInfo.pid === 0) {
      // 这是顶级菜单 需要创建children数组
      rootRoutes.push(routeInfo.data);
    } else {
      // 这是子菜单，需要找到父菜单
      const parentRouteInfo = routeMaps.get(routeInfo.pid);
      if (parentRouteInfo) {
        // 如果父菜单有children数组，则添加到children，否则创建
        if (!parentRouteInfo.data.children) {
          parentRouteInfo.data.children = [];
        }
        parentRouteInfo.data.children.push(routeInfo.data);
      }
    }
  }

  // 2. 处理路径拼接和redirect设置
  for (const route of rootRoutes) {
    processRoutePath(route);
  }

  // 3. 将处理后的顶级菜单添加到routes数组中
  routes.push(...rootRoutes);

  return routes;
}

/**
 * 递归处理路由路径
 * 1. 如果当前路由有子路由，但自身没有component，则设置redirect到第一个子路由
 * 2. 子路由的path需要拼接父路由的path
 */
function processRoutePath(route: RouteChildrenConfigsTable): void {
  if (!route.children || route.children.length === 0) {
    return;
  }

  // // 如果当前路由没有component，但有子路由，则设置redirect到第一个子路由（前端做了的跳转逻辑）
  // if (!route.component && route.children.length > 0) {
  //   const firstChild = route.children[0];
  //   if (firstChild.path) {
  //     // 拼接路径
  //     if (route.path && firstChild.path) {
  //       route.redirect = `${route.path}/${firstChild.path}`;
  //     } else if (firstChild.path) {
  //       route.redirect = firstChild.path;
  //     }
  //   }
  // }

  // 处理子路由的路径拼接
  for (const child of route.children) {
    if (route.path && child.path && !child.path.startsWith('/')) {
      // 拼接父路由路径，但避免双斜杠
      const parentPath = route.path.endsWith('/')
        ? route.path.slice(0, -1)
        : route.path;
      const childPath = child.path.startsWith('/')
        ? child.path.slice(1)
        : child.path;
      child.path = `${parentPath}/${childPath}`;
    }

    // 递归处理子路由的子路由
    processRoutePath(child);
  }
}

function isValueAddValue(object: any, value: any, key: string) {
  if (
    typeof value === 'boolean' ||
    (value !== null && value !== undefined && value !== '')
  ) {
    object[key] = value;
  }
}
