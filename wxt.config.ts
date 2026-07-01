import { defineConfig } from "wxt"

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: () => ({
    name: "OpenRead",
    description: "Open-source BYOK web translation for painless bilingual reading.",
    permissions: ["activeTab", "contextMenus", "scripting", "storage", "tabs"],
    host_permissions: ["<all_urls>"],
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      96: "icon/96.png",
      128: "icon/128.png",
    },
    action: {
      default_title: "OpenRead",
      default_icon: {
        16: "icon/16.png",
        32: "icon/32.png",
        48: "icon/48.png",
        96: "icon/96.png",
        128: "icon/128.png",
      },
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
  }),
})
