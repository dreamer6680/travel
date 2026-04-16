/**
 * @locator/runtime 的 Solid 预编译代码会从 `solid-js/web` 导入 `setStyleProperty`，
 * solid-js 1.9+ 已移除该导出。Webpack 将 `solid-js/web` 指向本文件，真实实现从
 * `solid-js/web-locator-internals` 转发（见 next.config.mjs 中的 alias）。
 */
export function setStyleProperty(el, name, value) {
  if (el?.style) el.style.setProperty(name, value)
}

export * from "solid-js/web-locator-internals"
