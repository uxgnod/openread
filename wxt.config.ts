import { defineConfig } from "wxt"

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: () => ({
    name: "OpenRead",
    description: "Configurable bilingual web translation for careful readers.",
    permissions: ["activeTab", "storage", "tabs"],
    host_permissions: ["<all_urls>"],
    action: {
      default_title: "OpenRead",
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
  }),
})
