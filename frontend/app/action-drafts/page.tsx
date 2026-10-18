import { ModulePlaceholder } from "@/components/layout/module-placeholder"
import { navItems } from "@/lib/nav"

/** 操作草稿页。后续在这里确认或取消尚未执行的草稿。 */
export default function ActionDraftsPage() {
  const item = navItems.find((entry) => entry.href === "/action-drafts")!

  return <ModulePlaceholder title={item.label} description={item.description} />
}
