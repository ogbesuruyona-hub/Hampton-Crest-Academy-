import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Undo,
  Redo,
} from "lucide-react";

const ToolbarButton = ({ active, onClick, title, children, testid }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    data-testid={testid}
    className={`h-8 w-8 flex items-center justify-center border transition-colors ${
      active
        ? "border-[var(--hc-gold)] bg-[var(--hc-gold-soft)] text-[var(--hc-gold)]"
        : "border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]"
    }`}
  >
    {children}
  </button>
);

export const RichTextEditor = ({ value, onChange, placeholder, testid }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-[var(--hc-gold)] underline underline-offset-4 hover:opacity-80",
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Write…",
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "hc-prose min-h-[240px] max-h-[480px] overflow-y-auto px-4 py-3 bg-[var(--hc-bg)] border border-[var(--hc-border)] border-t-0 text-[var(--hc-text)] focus:outline-none",
        "data-testid": testid || "rich-text-editor",
      },
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== undefined && value !== current) {
      editor.commands.setContent(value || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes("link").href || "";
    const url = window.prompt("URL", previous);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="border border-[var(--hc-border)]">
      <div className="flex flex-wrap gap-1 p-2 bg-[var(--hc-surface)] border-b border-[var(--hc-border)]">
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
          testid="rte-h2"
        >
          <Heading2 className="h-4 w-4" strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
          testid="rte-h3"
        >
          <Heading3 className="h-4 w-4" strokeWidth={1.5} />
        </ToolbarButton>
        <span className="w-px h-6 bg-[var(--hc-border)] mx-1 self-center" />
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
          testid="rte-bold"
        >
          <Bold className="h-4 w-4" strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
          testid="rte-italic"
        >
          <Italic className="h-4 w-4" strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strike"
          testid="rte-strike"
        >
          <Strikethrough className="h-4 w-4" strokeWidth={1.5} />
        </ToolbarButton>
        <span className="w-px h-6 bg-[var(--hc-border)] mx-1 self-center" />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bulleted list"
          testid="rte-ul"
        >
          <List className="h-4 w-4" strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
          testid="rte-ol"
        >
          <ListOrdered className="h-4 w-4" strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
          testid="rte-quote"
        >
          <Quote className="h-4 w-4" strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code block"
          testid="rte-code"
        >
          <Code className="h-4 w-4" strokeWidth={1.5} />
        </ToolbarButton>
        <span className="w-px h-6 bg-[var(--hc-border)] mx-1 self-center" />
        <ToolbarButton active={editor.isActive("link")} onClick={setLink} title="Link" testid="rte-link">
          <LinkIcon className="h-4 w-4" strokeWidth={1.5} />
        </ToolbarButton>
        <span className="w-px h-6 bg-[var(--hc-border)] mx-1 self-center" />
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
          testid="rte-undo"
        >
          <Undo className="h-4 w-4" strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
          testid="rte-redo"
        >
          <Redo className="h-4 w-4" strokeWidth={1.5} />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};
