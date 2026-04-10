"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { useCallback } from "react"

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

function ToolbarButton({
  onClick,
  isActive,
  children,
  title,
}: {
  onClick: () => void
  isActive: boolean
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`min-h-[36px] min-w-[36px] rounded-lg px-2 py-1 text-sm font-medium transition-colors
        ${
          isActive
            ? "bg-[var(--color-primary,#2563eb)] text-white"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
        }`}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "הקלד כאן...",
}: RichTextEditorProps) {
  const handleUpdate = useCallback(
    ({ editor }: { editor: { getHTML: () => string } }) => {
      onChange(editor.getHTML())
    },
    [onChange]
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: handleUpdate,
    editorProps: {
      attributes: {
        dir: "rtl",
        class:
          "prose prose-sm max-w-none min-h-[200px] px-4 py-3 focus:outline-none [&_p]:my-1 [&_ul]:pr-5 [&_ol]:pr-5",
      },
    },
  })

  if (!editor) return null

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 px-2 py-1.5 dark:border-white/10">
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          isActive={editor.isActive("heading", { level: 2 })}
          title="כותרת"
        >
          H2
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          isActive={editor.isActive("heading", { level: 3 })}
          title="כותרת משנה"
        >
          H3
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-white/10" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="מודגש"
        >
          <strong>B</strong>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="נטוי"
        >
          <em>I</em>
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-white/10" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="רשימה"
        >
          &bull;
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="רשימה ממוספרת"
        >
          1.
        </ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}
