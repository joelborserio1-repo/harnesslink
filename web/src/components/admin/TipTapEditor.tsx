"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect, useState } from "react";

// Rich-text editor for authoring new articles. Emits TipTap JSON + rendered
// HTML into hidden form fields so the enclosing server action can persist both
// (body_json is the editable source of truth; body_html is what the site renders).
function Btn({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-sm font-semibold ${active ? "bg-navy text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") editor.chain().focus().unsetLink().run();
    else editor.chain().focus().setLink({ href: url }).run();
  };
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-neutral-200 p-2">
      <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>B</Btn>
      <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><i>I</i></Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>H2</Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}>H3</Btn>
      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>• List</Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>1. List</Btn>
      <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}>❝</Btn>
      <Btn onClick={setLink} active={editor.isActive("link")}>Link</Btn>
      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()}>―</Btn>
    </div>
  );
}

export default function TipTapEditor({ initialJSON }: { initialJSON?: object | null }) {
  const [json, setJson] = useState("");
  const [html, setHtml] = useState("");

  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: initialJSON ?? "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setJson(JSON.stringify(editor.getJSON()));
      setHtml(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor) {
      setJson(JSON.stringify(editor.getJSON()));
      setHtml(editor.getHTML());
    }
  }, [editor]);

  return (
    <div className="rounded-lg border border-neutral-300 bg-white">
      {editor && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="prose-article max-w-none px-4 py-3 [&_.ProseMirror]:min-h-[280px] [&_.ProseMirror]:outline-none"
      />
      <input type="hidden" name="body_json" value={json} />
      <input type="hidden" name="body_html" value={html} />
      <input type="hidden" name="body_format" value="tiptap_json" />
    </div>
  );
}
