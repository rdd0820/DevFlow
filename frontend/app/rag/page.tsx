import { ModulePlaceholder } from "@/components/layout/module-placeholder"
import { navItems } from "@/lib/nav"

/** RAG 工作室。后续在这里上传资料、测试召回并基于证据回答。 */
export default function RagPage() {
  const item = navItems.find((entry) => entry.href === "/rag")!

  return <ModulePlaceholder title={item.label} description={item.description} />
}
