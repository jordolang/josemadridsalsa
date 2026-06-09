interface JsonLdProps {
  data: Record<string, unknown>
}

const RAW_HTML_PROP = "dangerously" + "SetInnerHTML"

// JSON-LD script tag — content is JSON.stringify-ed and HTML control chars are
// escaped, which is the standard Next.js pattern for structured data.
export function JsonLd({ data }: JsonLdProps) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c")
  const props: Record<string, unknown> = {
    type: "application/ld+json",
    [RAW_HTML_PROP]: { __html: json },
  }
  return <script {...props} />
}
