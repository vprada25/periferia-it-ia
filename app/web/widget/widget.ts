import { AGENT_PROFILE } from "@oc/contracts/agent-profile"

/**
 * Embeddable chat launcher (ADR-014). Usage on any site:
 *   <script src="https://<app>/widget.js" async></script>
 * Adds a floating button that opens /embed in an iframe; the chat itself is the same component as the dashboard.
 */
;(() => {
  const script = document.currentScript as HTMLScriptElement | null
  if (!script) return
  const origin = new URL(script.src).origin
  const title = script.dataset.title ?? AGENT_PROFILE.name

  const frame = document.createElement("iframe")
  frame.src = `${origin}/embed`
  frame.title = title
  Object.assign(frame.style, {
    position: "fixed", bottom: "84px", right: "20px", width: "400px", height: "600px", maxHeight: "80vh",
    maxWidth: "calc(100vw - 40px)", border: "1px solid #dfe3e8", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,.18)",
    display: "none", zIndex: "2147483646", background: "#fff",
  } satisfies Partial<CSSStyleDeclaration>)

  const button = document.createElement("button")
  button.type = "button"
  const avatar = document.createElement("img")
  avatar.src = `${origin}${AGENT_PROFILE.avatarPath}`
  avatar.alt = title
  Object.assign(avatar.style, { width: "40px", height: "40px", borderRadius: "50%", background: "#e6edff" } satisfies Partial<CSSStyleDeclaration>)
  const label = document.createElement("span")
  label.textContent = title
  button.append(avatar, label)
  button.setAttribute("aria-expanded", "false")
  Object.assign(button.style, {
    position: "fixed", bottom: "20px", right: "20px", padding: "5px 16px 5px 5px", borderRadius: "999px", border: "1px solid #dfe3e8",
    background: "#fff", color: "#1c2430", font: "600 14px system-ui, sans-serif", cursor: "pointer", zIndex: "2147483647",
    display: "flex", alignItems: "center", gap: "10px",
    boxShadow: "0 4px 14px rgba(0,0,0,.2)",
  } satisfies Partial<CSSStyleDeclaration>)
  button.addEventListener("click", () => {
    const open = frame.style.display === "none"
    frame.style.display = open ? "block" : "none"
    button.setAttribute("aria-expanded", String(open))
  })

  document.body.append(frame, button)
})()
