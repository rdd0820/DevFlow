import { ModulePlaceholder } from "@/components/layout/module-placeholder"
import { navItems } from "@/lib/nav"

/** 代码关系页。后续在这里搜索符号、调用关系和 PR 快照。 */
export default function CodeGraphPage() {
  const item = navItems.find((entry) => entry.href === "/code-graph")!

  return <ModulePlaceholder title={item.label} description={item.description} />
}
