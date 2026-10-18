import { ModulePlaceholder } from "@/components/layout/module-placeholder"
import { navItems } from "@/lib/nav"

/** 项目知识列表页。后续在这里按仓库展示知识库卡片。 */
export default function KnowledgePage() {
  const item = navItems.find((entry) => entry.href === "/knowledge")!

  return <ModulePlaceholder title={item.label} description={item.description} />
}
