import { defineBackground } from "#imports"
import { registerMessageRouter } from "@/background/message-router"

export default defineBackground({
  type: "module",
  main() {
    registerMessageRouter()
  },
})
