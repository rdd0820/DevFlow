import { ModulePlaceholder } from "@/components/layout/module-placeholder"
import { navItems } from "@/lib/nav"

/** 协作运行记录页。后续在这里查看每次多步骤任务的过程和结论。 */
export default function WorkflowRunsPage() {
  const item = navItems.find((entry) => entry.href === "/workflow-runs")!

  return <ModulePlaceholder title={item.label} description={item.description} />
}
