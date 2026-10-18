/**
 * 模块尚未实现时的占位内容。
 * title 与顶栏名称一致，description 说明进入这个页面后最终能做什么。
 */
export function ModulePlaceholder({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-10">
      <p className="text-xs tracking-wide text-teal-700 dark:text-teal-300">模块占位</p>
      <h1 className="text-xl font-medium text-foreground">{title}</h1>
      <p className="text-sm leading-7 text-muted-foreground">{description}</p>
    </section>
  )
}
