import { ModulePlaceholder } from "@/components/layout/module-placeholder"
import { navItems } from "@/lib/nav"

/** 工作台首页。对话、仓库侧栏和工作区面板后续替换这里的占位内容。 */
export default function DashboardPage() {
  const item = navItems[0]

  return <ModulePlaceholder title={item.label} description={item.description} />
}
