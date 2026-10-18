import { ModulePlaceholder } from "@/components/layout/module-placeholder"
import { navItems } from "@/lib/nav"

/** 团队工作区页。后续在这里管理多仓库工作区并生成跨仓库周报。 */
export default function WorkspacesPage() {
  const item = navItems.find((entry) => entry.href === "/workspaces")!

  return <ModulePlaceholder title={item.label} description={item.description} />
}
