import { ModulePlaceholder } from "@/components/layout/module-placeholder"
import { navItems } from "@/lib/nav"

/** 仓库页。后续在这里连接远程或本地仓库，并查看同步结果。 */
export default function ReposPage() {
  const item = navItems.find((entry) => entry.href === "/repos")!

  return <ModulePlaceholder title={item.label} description={item.description} />
}
