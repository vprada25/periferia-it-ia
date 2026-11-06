import { Chat } from "@/components/chat"

export const dynamic = "force-dynamic"

/** Chat only, meant to be framed by other sites through /widget.js (ADR-014). */
export default function EmbedPage() {
  return (
    <div className="embed">
      <Chat compact />
    </div>
  )
}
