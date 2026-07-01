import { defineBackground } from "#imports"
import { registerSelectionContextMenu } from "@/background/context-menu"
import { registerMessageRouter } from "@/background/message-router"

export default defineBackground({
  type: "module",
  main() {
    registerMessageRouter()
    registerSelectionContextMenu()
  },
})
