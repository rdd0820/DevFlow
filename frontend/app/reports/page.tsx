import { ModulePlaceholder } from "@/components/layout/module-placeholder"
import { navItems } from "@/lib/nav"

/** 研发周报页。后续在这里按仓库和时间范围生成周报。 */
export default function ReportsPage() {
  const item = navItems.find((entry) => entry.href === "/reports")!

  return <ModulePlaceholder title={item.label} description={item.description} />
}
