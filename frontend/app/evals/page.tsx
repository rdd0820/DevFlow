import { ModulePlaceholder } from "@/components/layout/module-placeholder"
import { navItems } from "@/lib/nav"

/** 评测页。后续在这里运行固定评测并查看逐题结果。 */
export default function EvalsPage() {
  const item = navItems.find((entry) => entry.href === "/evals")!

  return <ModulePlaceholder title={item.label} description={item.description} />
}
