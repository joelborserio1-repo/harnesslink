// Renders Strapi "Blocks" rich text (new articles written in Strapi) to HTML,
// so they go through the same article template as migrated WordPress HTML.
// Text is escaped; only the block types the editor produces are emitted.

type Text = {
  type: "text";
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
};
type Link = { type: "link"; url: string; children: Inline[] };
type Inline = Text | Link;
type Block =
  | { type: "paragraph"; children: Inline[] }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { type: "quote"; children: Inline[] }
  | { type: "code"; children: Inline[] }
  | { type: "list"; format: "ordered" | "unordered"; children: ListItem[] }
  | {
      type: "image";
      image: { url: string; alternativeText?: string | null; width?: number; height?: number; caption?: string | null };
    };
type ListItem = { type: "list-item"; children: Inline[] } | { type: "list"; format: "ordered" | "unordered"; children: ListItem[] };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function safeUrl(url: string): string {
  return /^(https?:|mailto:|tel:|\/)/i.test(url) ? url : "#";
}

function inline(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      if (n.type === "link") {
        const external = /^https?:/i.test(n.url) && !/harnesslink\.com/i.test(n.url);
        return `<a href="${esc(safeUrl(n.url))}"${external ? ' rel="noopener" target="_blank"' : ""}>${inline(n.children)}</a>`;
      }
      let t = esc(n.text).replace(/\n/g, "<br>");
      if (n.code) t = `<code>${t}</code>`;
      if (n.bold) t = `<strong>${t}</strong>`;
      if (n.italic) t = `<em>${t}</em>`;
      if (n.underline) t = `<u>${t}</u>`;
      if (n.strikethrough) t = `<s>${t}</s>`;
      return t;
    })
    .join("");
}

function list(format: "ordered" | "unordered", items: ListItem[]): string {
  const tag = format === "ordered" ? "ol" : "ul";
  return `<${tag}>${items
    .map((i) => (i.type === "list" ? list(i.format, i.children) : `<li>${inline(i.children)}</li>`))
    .join("")}</${tag}>`;
}

export function blocksToHtml(blocks: unknown, mediaBase: string): string {
  if (!Array.isArray(blocks)) return "";
  return (blocks as Block[])
    .map((b) => {
      switch (b.type) {
        case "paragraph":
          return `<p>${inline(b.children)}</p>`;
        case "heading": {
          // The page has one H1 (the headline); body headings start at H2.
          const level = Math.min(Math.max(b.level, 2), 6);
          return `<h${level}>${inline(b.children)}</h${level}>`;
        }
        case "quote":
          return `<blockquote><p>${inline(b.children)}</p></blockquote>`;
        case "code":
          return `<pre><code>${inline(b.children)}</code></pre>`;
        case "list":
          return list(b.format, b.children);
        case "image": {
          const img = b.image;
          if (!img?.url) return "";
          const src = img.url.startsWith("http") ? img.url : `${mediaBase}${img.url}`;
          const dims = img.width && img.height ? ` width="${img.width}" height="${img.height}"` : "";
          const caption = img.caption ? `<figcaption>${esc(img.caption)}</figcaption>` : "";
          return `<figure><img src="${esc(src)}" alt="${esc(img.alternativeText || "")}"${dims} loading="lazy" decoding="async">${caption}</figure>`;
        }
        default:
          return "";
      }
    })
    .join("\n");
}
