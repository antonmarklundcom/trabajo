'use client';

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import LinkExtension from '@tiptap/extension-link';

type Props = {
  value: string;
  onChange: (html: string) => void;
};

// The client-side half of blog image upload. Server-side validation
// (lib/image-storage.ts, namespace 'blog') is the actual security boundary —
// this only decides what the editor shows while that request is in flight.
async function uploadInlineImage(file: File): Promise<string> {
  const res = await fetch('/api/admin/blog/images', {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'No se pudo subir la imagen.');
  return data.url as string;
}

export default function PostEditor({ value, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      ImageExtension,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose-editor min-h-[300px] px-4 py-3 focus:outline-none',
      },
    },
  });

  // Keep the editor in sync if `value` changes from outside (e.g. loading a
  // different post) without fighting the user's own typing.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editor) return;
    try {
      const url = await uploadInlineImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    }
  }

  if (!editor) return null;

  return (
    <div className="rounded-[10px] border border-[#E7E1D6] bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#E7E1D6] px-2 py-1.5 bg-[#F5F1EA]">
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          Negrita
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          Cursiva
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          Lista
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          Lista numerada
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          Cita
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          Código
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            const url = window.prompt('URL del enlace');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
        >
          Enlace
        </ToolbarButton>
        <ToolbarButton onClick={() => fileInputRef.current?.click()}>
          + Imagen
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      <EditorContent editor={editor} />
      <style>{`
        .prose-editor p { margin-bottom: 0.75rem; }
        .prose-editor h2 { font-size: 1.35rem; font-weight: 700; margin: 1.25rem 0 0.5rem; }
        .prose-editor h3 { font-size: 1.15rem; font-weight: 600; margin: 1rem 0 0.375rem; }
        .prose-editor ul { list-style: disc; padding-left: 1.25rem; margin-bottom: 0.75rem; }
        .prose-editor ol { list-style: decimal; padding-left: 1.25rem; margin-bottom: 0.75rem; }
        .prose-editor blockquote { border-left: 3px solid #E7E1D6; padding-left: 1rem; color: #57514A; margin-bottom: 0.75rem; }
        .prose-editor img { max-width: 100%; border-radius: 8px; margin: 0.5rem 0; }
        .prose-editor code { background: #F5F1EA; padding: 0.15rem 0.4rem; border-radius: 4px; }
        .prose-editor pre { background: #1E1B17; color: #FBF9F6; padding: 1rem; border-radius: 8px; overflow-x: auto; }
      `}</style>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-[6px] text-xs font-medium transition-colors ${
        active ? 'bg-[#C0362A] text-white' : 'text-[#57514A] hover:bg-white'
      }`}
    >
      {children}
    </button>
  );
}
