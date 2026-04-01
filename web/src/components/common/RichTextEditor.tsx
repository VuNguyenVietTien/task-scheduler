"use client"

import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from "react"
import type { ForwardRefRenderFunction } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Table from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import TextAlign from "@tiptap/extension-text-align"
import { Color } from "@tiptap/extension-color"
import TextStyle from "@tiptap/extension-text-style"
import Underline from "@tiptap/extension-underline"
import Placeholder from "@tiptap/extension-placeholder"
import { Node, Editor } from "@tiptap/core"
import type { NodeViewProps } from '@tiptap/react'
import type { ChainedCommands, RawCommands } from '@tiptap/core'
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ImageIcon,
  TableIcon,
  Trash2,
  Undo,
  Redo,
  MoveHorizontal,
  LineChartIcon as LineHeight,
} from "lucide-react"
import { imageService } from "@/services/imageService"
import { htmlToMarkdown, markdownToHtml, looksLikeMarkdown } from '@/utils/editor-markdown'
import { toast } from 'sonner'
import { TreeBuilderPanel } from './TreeBuilderPanel'

// Mở rộng ChainedCommands để thêm phương thức setLineHeight và setMention
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    setLineHeight: (lineHeight: string) => ReturnType
    setMention: (options: { id: string; label: string; username: string }) => ReturnType
  }
}

// Custom extension for line height
const LineHeightExtension = Node.create({
  name: "lineHeight",
  addOptions() {
    return {
      types: ["paragraph", "heading"],
      lineHeights: ["1", "1.2", "1.5", "2", "2.5", "3"],
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: "1.5",
            parseHTML: (element: HTMLElement) => element.style.lineHeight,
            renderHTML: (attributes: Record<string, any>) => {
              if (!attributes.lineHeight) {
                return {}
              }
              return {
                style: `line-height: ${attributes.lineHeight}`,
              }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setLineHeight: (lineHeight: string) => ({ commands }: { commands: any }) => {
        return this.options.types.every((type: string) => commands.updateAttributes(type, { lineHeight }))
      },
    } as Partial<RawCommands>
  },
})

// Mention extension for @ mentions
const Mention = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => {
          return {
            'data-id': attributes.id,
          }
        },
      },
      label: {
        default: null,
        parseHTML: element => element.getAttribute('data-label'),
        renderHTML: attributes => {
          return {
            'data-label': attributes.label,
          }
        },
      },
      username: {
        default: null,
        parseHTML: element => element.getAttribute('data-username'),
        renderHTML: attributes => {
          return {
            'data-username': attributes.username,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-mention]',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', { 
      ...HTMLAttributes,
      'data-mention': '',
      class: 'mention',
    }, `@${node.attrs.username}`]
  },

  addCommands() {
    return {
      setMention: (options: { id: string; label: string; username: string }) => ({ commands }: { commands: any }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        })
      },
    } as Partial<RawCommands>
  },
})

// Interface cho ResizableImageComponent
interface ResizableImageProps {
  node: {
    attrs: {
      src: string;
      alt?: string;
      width?: string | number;
      height?: string | number;
    }
  };
  updateAttributes: (attrs: Record<string, any>) => void;
  selected: boolean;
  editor: Editor;
  getPos: () => number;
}

// Custom resizable image component
const ResizableImageComponent = ({ 
  node, 
  updateAttributes, 
  selected, 
  editor, 
  getPos 
}: ResizableImageProps) => {
  const imageRef = useRef<HTMLImageElement>(null)
  const [size, setSize] = useState({ width: node.attrs.width || "auto", height: node.attrs.height || "auto" })
  const [resizing, setResizing] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  // Update size in the node when resizing is done
  useEffect(() => {
    if (!resizing && (size.width !== node.attrs.width || size.height !== node.attrs.height)) {
      updateAttributes({ width: size.width, height: size.height })
    }
  }, [resizing, size, node.attrs, updateAttributes])

  // Show menu when selected
  useEffect(() => {
    setShowMenu(selected)
  }, [selected])

  // Handle mouse down for resizing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, direction: "right" | "bottom" | "corner") => {
      e.preventDefault()
      e.stopPropagation()

      if (!imageRef.current) return

      const startSize = {
        width: imageRef.current.clientWidth,
        height: imageRef.current.clientHeight,
      }
      const startPos = { x: e.clientX, y: e.clientY }
      setResizing(true)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault()

        const dx = moveEvent.clientX - startPos.x
        const dy = moveEvent.clientY - startPos.y

        let newWidth = startSize.width
        let newHeight = startSize.height

        if (direction === "right") {
          newWidth = startSize.width + dx
          newHeight = (startSize.height * newWidth) / startSize.width
        } else if (direction === "bottom") {
          newHeight = startSize.height + dy
          newWidth = (startSize.width * newHeight) / startSize.height
        } else if (direction === "corner") {
          newWidth = startSize.width + dx
          newHeight = startSize.height + dy
        }

        setSize({
          width: Math.max(50, newWidth),
          height: Math.max(50, newHeight),
        })
      }

      const handleMouseUp = () => {
        setResizing(false)
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [updateAttributes],
  )

  // Delete image
  const deleteImage = () => {
    if (typeof getPos === "function") {
      const pos = getPos();
      editor.commands.deleteRange({ from: pos, to: pos + 1 });
    }
  }

  return (
    <NodeViewWrapper className="resizable-image-wrapper">
      <div className="image-container" style={{ position: "relative", display: "inline-block" }}>
        <img
          ref={imageRef}
          src={node.attrs.src || "/placeholder.svg"}
          alt={node.attrs.alt || ""}
          style={{
            width: size.width,
            height: size.height,
            cursor: "pointer",
            border: selected ? "2px solid #68cef8" : "none",
          }}
          draggable="true"
          onDragStart={(e) => {
            e.dataTransfer.setData(
              "text/plain",
              JSON.stringify({
                type: "image",
                attrs: node.attrs,
              }),
            )
          }}
        />

        {selected && (
          <>
            {/* Resize handles */}
            <div
              className="resize-handle resize-handle-right"
              onMouseDown={(e) => handleMouseDown(e, "right")}
              style={{
                position: "absolute",
                right: "-6px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "12px",
                height: "12px",
                backgroundColor: "white",
                border: "2px solid #68cef8",
                borderRadius: "50%",
                cursor: "ew-resize",
              }}
            />
            <div
              className="resize-handle resize-handle-bottom"
              onMouseDown={(e) => handleMouseDown(e, "bottom")}
              style={{
                position: "absolute",
                bottom: "-6px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "12px",
                height: "12px",
                backgroundColor: "white",
                border: "2px solid #68cef8",
                borderRadius: "50%",
                cursor: "ns-resize",
              }}
            />
            <div
              className="resize-handle resize-handle-corner"
              onMouseDown={(e) => handleMouseDown(e, "corner")}
              style={{
                position: "absolute",
                bottom: "-6px",
                right: "-6px",
                width: "12px",
                height: "12px",
                backgroundColor: "white",
                border: "2px solid #68cef8",
                borderRadius: "50%",
                cursor: "nwse-resize",
              }}
            />

            {/* Image menu */}
            <div
              className="image-menu"
              style={{
                position: "absolute",
                top: "-40px",
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "white",
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "4px",
                display: "flex",
                gap: "4px",
                boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
              }}
            >
              <button onClick={deleteImage} className="p-1 rounded hover:bg-gray-200" title="Delete image">
                <Trash2 size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// Custom image extension with resize support
const ResizableImage = Image.extend({
  name: "resizableImage",
  addAttributes() {
    return {
      src: {
        default: null
      },
      alt: {
        default: null
      },
      width: {
        default: "auto",
        parseHTML: (element: HTMLElement) => element.getAttribute("width") || "auto",
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.width) {
            return {}
          }
          return {
            width: attributes.width,
          }
        },
      },
      height: {
        default: "auto",
        parseHTML: (element: HTMLElement) => element.getAttribute("height") || "auto",
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.height) {
            return {}
          }
          return {
            height: attributes.height,
          }
        },
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent as any)
  },
})

// Types for editor props
interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mode?: 'full' | 'compact';
  className?: string;
  minHeight?: string;
  readOnly?: boolean;
  projectMembers?: { 
    role: string;
    joinedAt: string;
    user: {
      userId: string;
      username: string;
      avatarUrl: string;
    };
  }[];
  onMentionSelect?: (userId: string, username: string) => void;
}

// Main editor component with forwardRef
const RichTextEditorComponent: ForwardRefRenderFunction<any, RichTextEditorProps> = (
  { 
    value, 
    onChange, 
    placeholder = "Viết nội dung...", 
    mode = 'full', 
    className = '', 
    minHeight = '200px', 
    readOnly = false,
    projectMembers = [],
    onMentionSelect
  },
  ref
) => {
  const [editorKey, setEditorKey] = useState(Date.now())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showImageUrlInput, setShowImageUrlInput] = useState(false)
  const [imageUrlValue, setImageUrlValue] = useState('')
  const [showSymbolPicker, setShowSymbolPicker] = useState(false)
  const symbolPickerRef = useRef<HTMLDivElement>(null)
  const symbolBtnRef = useRef<HTMLButtonElement>(null)
  const [symbolPickerPos, setSymbolPickerPos] = useState<{ top: number; left: number } | null>(null)
  const [editorMode, setEditorMode] = useState<'wysiwyg' | 'markdown'>('wysiwyg')
  const [markdownValue, setMarkdownValue] = useState('')
  const [showTreeBuilder, setShowTreeBuilder] = useState(false)
  const [mentionPopup, setMentionPopup] = useState<{
    show: boolean;
    query: string;
    position: { x: number; y: number };
    items: { id: string; label: string; username: string; avatarUrl?: string }[];
    selectedIndex: number;
  }>({
    show: false,
    query: '',
    position: { x: 0, y: 0 },
    items: [],
    selectedIndex: 0,
  });

  // Thêm ref để theo dõi giá trị selectedIndex hiện tại
  const currentSelectedIndexRef = useRef<number>(0);
  // Thêm ref để theo dõi trạng thái đang xử lý Enter
  const isProcessingEnterRef = useRef<boolean>(false);
  
  // Configure editor with extensions
  const lastCursorPositionRef = useRef<{ from: number, to: number } | null>(null);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      LineHeightExtension,
      ResizableImage,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder,
      }),
      Mention,
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      // Lưu vị trí con trỏ hiện tại trước khi cập nhật giá trị
      const selection = editor.view.state.selection;
      lastCursorPositionRef.current = { from: selection.from, to: selection.to };
      
      // Chỉ gọi onChange nếu nội dung thực sự thay đổi
      const newContent = editor.getHTML();
      if (newContent !== value) {
        onChange(newContent);
      }
    },
    onSelectionUpdate: ({ editor }) => {
      // Bỏ qua sự kiện onSelectionUpdate nếu đang xử lý Enter
      if (isProcessingEnterRef.current) {
        return;
      }

      // Cập nhật vị trí con trỏ khi người dùng di chuyển con trỏ
      const selection = editor.view.state.selection;
      lastCursorPositionRef.current = { from: selection.from, to: selection.to };
      
      // Check for @ mentions
      const { from } = selection;
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 50), from);
      const match = textBefore.match(/@(\w*)$/);
      
      if (match) {
        const query = match[1].toLowerCase();
        const items = projectMembers
          .filter(member => 
            member.user.username.toLowerCase().includes(query)
          )
          .map(member => ({
            id: member.user.userId,
            label: member.user.username, 
            username: member.user.username,
            avatarUrl: member.user.avatarUrl
          }));
        
        if (items.length > 0) {
          // Get position of the @ symbol
          const pos = from - (match[0].length - 1);
          const coords = editor.view.coordsAtPos(pos);
          
          // Nếu popup đã hiển thị, giữ nguyên giá trị selectedIndex
          const newSelectedIndex = mentionPopup.show ? currentSelectedIndexRef.current : 0;
          
          // Sử dụng vị trí tuyệt đối so với trang thay vì tương đối
          setMentionPopup({
            show: true,
            query,
            position: {
              x: coords.left,
              y: coords.bottom
            },
            items,
            selectedIndex: newSelectedIndex
          });
        } else {
          setMentionPopup(prev => ({ ...prev, show: false }));
        }
      } else {
        setMentionPopup(prev => ({ ...prev, show: false }));
      }
    },
  })

  // Cập nhật currentSelectedIndexRef mỗi khi mentionPopup.selectedIndex thay đổi
  useEffect(() => {
    currentSelectedIndexRef.current = mentionPopup.selectedIndex;
  }, [mentionPopup.selectedIndex]);

  // Handle mention selection
  const handleMentionSelect = (item: { id: string; label: string; username: string }) => {
    if (editor) {
      // Delete the @ and query text
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 50), from);
      const match = textBefore.match(/@(\w*)$/);
      
      if (match) {
        const startPos = from - match[0].length;
        editor.chain().focus().deleteRange({ from: startPos, to: from }).run();
        
        // Insert the mention with proper formatting
        (editor.chain().focus() as any).setMention({
          id: item.id,
          label: item.label,
          username: item.username
        }).run();
        
        // Add a space after the mention
        editor.chain().focus().insertContent(' ').run();
        
        // Notify parent component
        if (onMentionSelect) {
          onMentionSelect(item.id, item.username);
        }
      }
    }
    
    // Đặt lại trạng thái xử lý Enter
    isProcessingEnterRef.current = false;
    setMentionPopup(prev => ({ ...prev, show: false }));
  };

  // Handle keyboard navigation in mention popup
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!mentionPopup.show || mentionPopup.items.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = (currentSelectedIndexRef.current + 1) % mentionPopup.items.length;
      currentSelectedIndexRef.current = newIndex;
      
      setMentionPopup(prev => ({
        ...prev,
        selectedIndex: newIndex
      }));
      console.log('ArrowDown: Selected index now:', newIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = (currentSelectedIndexRef.current - 1 + mentionPopup.items.length) % mentionPopup.items.length;
      currentSelectedIndexRef.current = newIndex;
      
      setMentionPopup(prev => ({
        ...prev,
        selectedIndex: newIndex
      }));
      console.log('ArrowUp: Selected index now:', newIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      
      // Đánh dấu đang xử lý Enter để ngăn chặn onSelectionUpdate
      isProcessingEnterRef.current = true;
      
      // Sử dụng currentSelectedIndexRef thay vì mentionPopup.selectedIndex
      if (mentionPopup.items.length > 0) {
        const currentIndex = currentSelectedIndexRef.current;
        console.log('Selecting item with index:', currentIndex);
        
        if (currentIndex >= 0 && currentIndex < mentionPopup.items.length) {
          const selectedItem = mentionPopup.items[currentIndex];
          console.log('Selected item for mention:', selectedItem);
          
          // Xử lý mention ngay lập tức
          handleMentionSelect(selectedItem);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMentionPopup(prev => ({ ...prev, show: false }));
    }
  };

  // Expose editor methods via ref
  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
    focus: () => editor?.chain().focus().run(),
    blur: () => editor?.commands.blur(),
  }))

  // Update content when prop changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      // Lưu vị trí con trỏ hiện tại
      const selection = editor.view.state.selection;
      const cursorPosition = { from: selection.from, to: selection.to };
      
      // Cập nhật nội dung
      editor.commands.setContent(value);
      
      // Khôi phục vị trí con trỏ nếu đang focus
      if (editor.isFocused && cursorPosition.from > 0) {
        setTimeout(() => {
          editor.commands.setTextSelection(cursorPosition);
        }, 0);
      }
    }
  }, [value, editor])

  // Drag and drop image handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    
    if (!editor) return
    
    const files = e.dataTransfer.files
    
    if (files && files.length > 0) {
      const file = files[0]
      
      if (file.type.match(/^image\//)) {
        // Sử dụng imageService để tạo URL tạm thời
        const { tempUrl } = imageService.createTempImage(file);
        
        // Chèn hình ảnh với URL tạm thời vào editor
        editor.chain().focus().setImage({ src: tempUrl }).run()
      }
    }
  }

  // Close symbol picker when clicking outside
  useEffect(() => {
    if (!showSymbolPicker) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        symbolPickerRef.current && !symbolPickerRef.current.contains(e.target as HTMLElement) &&
        symbolBtnRef.current && !symbolBtnRef.current.contains(e.target as HTMLElement)
      ) {
        setShowSymbolPicker(false)
        setSymbolPickerPos(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSymbolPicker])

  // Insert a symbol at cursor position (keeps dropdown open for repeated insertion)
  const insertSymbol = (symbol: string) => {
    editor?.chain().focus().insertContent(symbol).run()
  }

  // Switch WYSIWYG → Markdown: convert current HTML to markdown text
  const switchToMarkdown = () => {
    if (!editor) return
    const md = htmlToMarkdown(editor.getHTML())
    setMarkdownValue(md)
    setEditorMode('markdown')
  }

  // Switch Markdown → WYSIWYG: parse markdown and set in editor
  const switchToWysiwyg = () => {
    if (!editor) return
    const html = markdownToHtml(markdownValue)
    editor.commands.setContent(html, false)
    onChange(html)
    setEditorMode('wysiwyg')
  }

  // Handle markdown textarea changes — sync to parent as HTML
  const handleMarkdownChange = (md: string) => {
    setMarkdownValue(md)
    onChange(markdownToHtml(md))
  }

  // Copy current content as plain Markdown
  const copyAsMarkdown = async () => {
    const md = editorMode === 'markdown' ? markdownValue : htmlToMarkdown(editor?.getHTML() || '')
    await navigator.clipboard.writeText(md)
    toast.success('Copied as Markdown')
  }

  // Copy current content as rich text (HTML in clipboard)
  const copyAsRichText = async () => {
    try {
      const html = editorMode === 'markdown' ? markdownToHtml(markdownValue) : (editor?.getHTML() || '')
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) }),
      ])
      toast.success('Copied as Rich Text')
    } catch {
      toast.error('Rich text copy not supported in this browser')
    }
  }

  // Handle paste in WYSIWYG mode: auto-convert pasted markdown to rich text
  const handlePaste = (e: React.ClipboardEvent) => {
    if (editorMode !== 'wysiwyg' || !editor) return
    const text = e.clipboardData.getData('text/plain')
    if (text && looksLikeMarkdown(text)) {
      e.preventDefault()
      const html = markdownToHtml(text)
      editor.chain().focus().insertContent(html).run()
    }
  }

  // Add image via file upload
  const addImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Add image via URL — only allow http/https to prevent javascript:/data: injection
  const addImageFromUrl = () => {
    const trimmed = imageUrlValue.trim()
    if (!trimmed || !editor) return
    if (!/^https?:\/\//i.test(trimmed)) return
    editor.chain().focus().setImage({ src: trimmed }).run()
    setImageUrlValue('')
    setShowImageUrlInput(false)
  }

  // Handle file selection for image upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && editor) {
      console.log('Hình ảnh được chọn:', file.name);
      
      // Tạo URL tạm thời cho hình ảnh
      const { tempUrl } = imageService.createTempImage(file);
      
      // Chèn hình ảnh vào editor
      editor.chain().focus().setImage({ src: tempUrl }).run();
      
      console.log('Đã chèn hình ảnh vào editor với URL tạm thời:', tempUrl);
    }
    
    // Reset input để có thể chọn lại cùng một file
    e.target.value = ''
  }

  // Add table
  const addTable = () => {
    // Thêm bảng với thiết lập mặc định
    editor?.chain().focus().insertTable({ 
      rows: 3, 
      cols: 3, 
      withHeaderRow: true 
    }).run();

    // Thêm CSS cho bảng để nó hiển thị rõ ràng hơn
    setTimeout(() => {
      if (editor && editor.isActive('table')) {
        // Focus vào ô đầu tiên để người dùng có thể bắt đầu nhập liệu
        editor.chain().focus().run();
      }
    }, 10);
  }

  // Delete table
  const deleteTable = () => {
    editor?.chain().focus().deleteTable().run();
  }

  // Add row to table
  const addRowToTable = () => {
    editor?.chain().focus().addRowAfter().run();
  }

  // Add column to table
  const addColumnToTable = () => {
    editor?.chain().focus().addColumnAfter().run();
  }

  // Set line height
  const setLineHeight = (height: string) => {
    // Sử dụng type assertion để tránh lỗi TypeScript
    (editor?.chain().focus() as any)?.setLineHeight(height)?.run();
  }

  if (!editor) {
    return null
  }

  return (
    <div className={`rich-text-editor ${className}`} style={{ position: 'relative' }} onDrop={handleDrop} onDragOver={handleDragOver} onKeyDown={handleKeyDown} onPaste={handlePaste}>
      <style jsx global>{`
        .rich-text-editor {
          border: 1px solid #e5e7eb;
          border-radius: 0.375rem;
          overflow: hidden;
        }
        
        .rich-text-editor .ProseMirror {
          min-height: ${minHeight};
          padding: 1rem;
          outline: none;
        }
        
        .rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
        
        .rich-text-editor .editor-toolbar {
          padding: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
          background-color: #f9fafb;
        }
        
        .rich-text-editor button.toolbar-item {
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.25rem;
          border: none;
          background: none;
          cursor: pointer;
          color: #4b5563;
        }
        
        .rich-text-editor button.toolbar-item:hover {
          background-color: #e5e7eb;
        }
        
        .rich-text-editor button.toolbar-item.is-active {
          background-color: #e5e7eb;
          color: #1f2937;
        }
        
        .rich-text-editor .separator {
          width: 1px;
          height: 1.5rem;
          background-color: #e5e7eb;
          margin: 0 0.25rem;
        }
        
        .rich-text-editor .dropdown {
          position: relative;
          display: inline-block;
        }
        
        .rich-text-editor .dropdown-content {
          display: none;
          position: absolute;
          background-color: white;
          min-width: 160px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          border-radius: 0.25rem;
          z-index: 10;
          padding: 0.5rem;
        }
        
        .rich-text-editor .dropdown-content button {
          display: block;
          width: 100%;
          text-align: left;
          padding: 0.5rem;
          border: none;
          background: none;
          cursor: pointer;
          border-radius: 0.25rem;
        }
        
        .rich-text-editor .dropdown-content button:hover {
          background-color: #f3f4f6;
        }
        
        .rich-text-editor .dropdown:hover .dropdown-content {
          display: block;
        }
        
        .rich-text-editor table {
          border-collapse: collapse;
          margin: 1rem 0;
          overflow: hidden;
          table-layout: fixed;
          width: 100%;
          border: 2px solid #d1d5db;
        }
        
        .rich-text-editor table td,
        .rich-text-editor table th {
          border: 2px solid #d1d5db;
          box-sizing: border-box;
          min-width: 1em;
          padding: 0.75rem;
          position: relative;
          vertical-align: top;
        }
        
        .rich-text-editor table th {
          background-color: #f3f4f6;
          font-weight: 600;
          border-bottom: 3px solid #9ca3af;
        }
        
        .rich-text-editor img {
          max-width: 100%;
          height: auto;
        }
        
        .rich-text-editor blockquote {
          border-left: 3px solid #e5e7eb;
          padding-left: 1rem;
          margin-left: 0;
          margin-right: 0;
          color: #6b7280;
        }
        
        /* Styles for lists */
        .rich-text-editor ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        
        .rich-text-editor ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        
        .rich-text-editor li {
          margin-bottom: 0.25rem;
        }
        
        .rich-text-editor li p {
          margin: 0;
        }
        
        /* Fix for nested lists */
        .rich-text-editor ul ul,
        .rich-text-editor ol ol,
        .rich-text-editor ul ol,
        .rich-text-editor ol ul {
          margin-top: 0.25rem;
          margin-bottom: 0;
        }
        
        .rich-text-editor ul ul {
          list-style-type: circle;
        }
        
        .rich-text-editor ul ul ul {
          list-style-type: square;
        }
        
        .rich-text-editor ol ol {
          list-style-type: lower-alpha;
        }
        
        .rich-text-editor ol ol ol {
          list-style-type: lower-roman;
        }
        
        /* Mention styles */
        .rich-text-editor .mention {
          color: #3b82f6;
          font-weight: 500;
          background-color: #eff6ff;
          border-radius: 0.25rem;
          padding: 0.1rem 0.3rem;
          white-space: nowrap;
        }
        
        .mention-popup {
          position: absolute;
          background-color: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.375rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          z-index: 50;
          max-height: 200px;
          overflow-y: auto;
          min-width: 200px;
        }
        
        .mention-item {
          padding: 0.5rem 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .mention-item:hover,
        .mention-item.selected {
          background-color: #f3f4f6;
        }

        .mention-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
        }

        /* Code block styles */
        .rich-text-editor pre {
          background-color: #1e1e1e;
          color: #d4d4d4;
          border-radius: 0.375rem;
          padding: 1rem;
          margin: 0.75rem 0;
          overflow-x: auto;
          font-family: 'Cascadia Code', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 0.875rem;
          line-height: 1.6;
          white-space: pre;
          tab-size: 2;
        }

        .rich-text-editor pre code {
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          font-size: inherit;
          color: inherit;
          white-space: pre;
        }

        /* Inline code */
        .rich-text-editor code {
          background-color: #f3f4f6;
          color: #e11d48;
          border-radius: 0.25rem;
          padding: 0.1rem 0.35rem;
          font-family: 'Cascadia Code', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 0.85em;
        }

        /* Markdown textarea */
        .rich-text-editor .markdown-editor {
          width: 100%;
          min-height: ${minHeight};
          padding: 1rem;
          font-family: 'Cascadia Code', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 0.875rem;
          line-height: 1.7;
          color: #1f2937;
          background-color: #fafafa;
          border: none;
          outline: none;
          resize: vertical;
          tab-size: 2;
          white-space: pre;
          overflow-x: auto;
        }

        .rich-text-editor .mode-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
          padding: 0.15rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .rich-text-editor .mode-badge.wysiwyg {
          background-color: #e0e7ff;
          color: #4f46e5;
        }

        .rich-text-editor .mode-badge.markdown {
          background-color: #fef3c7;
          color: #92400e;
        }

        /* Symbol picker popup */
        .symbol-picker-popup {
          /* position/top/left/z-index set via inline style (fixed) */
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.375rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
          padding: 0.5rem;
          min-width: 160px;
        }

        .symbol-picker-popup .symbol-label {
          font-size: 0.7rem;
          color: #9ca3af;
          padding: 0.1rem 0.25rem 0.35rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .symbol-picker-popup button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.3rem 0.5rem;
          border: none;
          background: none;
          cursor: pointer;
          border-radius: 0.25rem;
          font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
          font-size: 0.85rem;
          text-align: left;
          color: #374151;
        }

        .symbol-picker-popup button:hover {
          background-color: #f3f4f6;
        }
      `}</style>

      {!readOnly && (
        <div className="editor-toolbar">
          {/* Mode toggle — always visible */}
          <button
            type="button"
            onClick={editorMode === 'wysiwyg' ? switchToMarkdown : switchToWysiwyg}
            className="toolbar-item"
            title={editorMode === 'wysiwyg' ? 'Switch to Markdown mode' : 'Switch to WYSIWYG mode'}
          >
            <span className={`mode-badge ${editorMode}`}>
              {editorMode === 'wysiwyg' ? 'MD' : 'WY'}
            </span>
          </button>

          {/* Copy actions */}
          <button type="button" onClick={copyAsMarkdown} className="toolbar-item" title="Copy as Markdown">
            <span className="text-xs">⎘MD</span>
          </button>
          <button type="button" onClick={copyAsRichText} className="toolbar-item" title="Copy as Rich Text">
            <span className="text-xs">⎘RT</span>
          </button>

          <div className="separator" />

          {/* WYSIWYG-only controls — hidden in markdown mode */}
          {editorMode === 'wysiwyg' && mode === 'full' && (
            <>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`toolbar-item ${editor.isActive("heading", { level: 1 }) ? "is-active" : ""}`}
                title="Heading 1"
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`toolbar-item ${editor.isActive("heading", { level: 2 }) ? "is-active" : ""}`}
                title="Heading 2"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`toolbar-item ${editor.isActive("heading", { level: 3 }) ? "is-active" : ""}`}
                title="Heading 3"
              >
                H3
              </button>
              <div className="separator" />
            </>
          )}

          {/* All WYSIWYG-only formatting controls */}
          {editorMode === 'wysiwyg' && <>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`toolbar-item ${editor.isActive("bold") ? "is-active" : ""}`}
            title="Bold"
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`toolbar-item ${editor.isActive("italic") ? "is-active" : ""}`}
            title="Italic"
          >
            <Italic size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`toolbar-item ${editor.isActive("underline") ? "is-active" : ""}`}
            title="Underline"
          >
            <UnderlineIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`toolbar-item ${editor.isActive("strike") ? "is-active" : ""}`}
            title="Strike"
          >
            <Strikethrough size={16} />
          </button>

          <div className="separator" />

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={`toolbar-item ${editor.isActive({ textAlign: "left" }) ? "is-active" : ""}`}
            title="Align left"
          >
            <AlignLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={`toolbar-item ${editor.isActive({ textAlign: "center" }) ? "is-active" : ""}`}
            title="Align center"
          >
            <AlignCenter size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={`toolbar-item ${editor.isActive({ textAlign: "right" }) ? "is-active" : ""}`}
            title="Align right"
          >
            <AlignRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            className={`toolbar-item ${editor.isActive({ textAlign: "justify" }) ? "is-active" : ""}`}
            title="Justify"
          >
            <AlignJustify size={16} />
          </button>

          <div className="separator" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`toolbar-item ${editor.isActive("bulletList") ? "is-active" : ""}`}
            title="Bullet list"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`toolbar-item ${editor.isActive("orderedList") ? "is-active" : ""}`}
            title="Ordered list"
          >
            <ListOrdered size={16} />
          </button>

          <div className="separator" />

          {/* Code block toggle */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`toolbar-item ${editor.isActive('codeBlock') ? 'is-active' : ''}`}
            title="Code block (``` to toggle)"
          >
            <span className="text-xs font-mono font-bold">{'{}'}</span>
          </button>

          {/* Tree structure builder */}
          <button
            type="button"
            onClick={() => setShowTreeBuilder(v => !v)}
            className={`toolbar-item ${showTreeBuilder ? 'is-active' : ''}`}
            title="Tree structure builder"
          >
            <span className="text-xs">🌲</span>
          </button>

          {/* Symbol picker */}
          <button
            ref={symbolBtnRef}
            type="button"
            onClick={() => {
              if (showSymbolPicker) {
                setShowSymbolPicker(false)
                setSymbolPickerPos(null)
              } else {
                const rect = symbolBtnRef.current?.getBoundingClientRect()
                if (rect) setSymbolPickerPos({ top: rect.bottom + 4, left: rect.left })
                setShowSymbolPicker(true)
              }
            }}
            className={`toolbar-item ${showSymbolPicker ? 'is-active' : ''}`}
            title="Insert tree symbols"
          >
            <span className="text-xs font-mono">├</span>
          </button>

          <div className="separator" />

          {/* Image: file upload */}
          <button type="button" onClick={addImage} className="toolbar-item" title="Upload ảnh từ máy">
            <ImageIcon size={16} />
          </button>
          {/* Image: from URL toggle */}
          <button
            type="button"
            onClick={() => { setShowImageUrlInput(v => !v); setImageUrlValue(''); }}
            className={`toolbar-item ${showImageUrlInput ? 'is-active' : ''}`}
            title="Chèn ảnh từ URL"
          >
            <span className="text-xs font-medium">URL</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: "none" }}
            title="Upload image"
            aria-label="Upload image"
          />

          <button type="button" onClick={addTable} className="toolbar-item" title="Thêm bảng">
            <TableIcon size={16} />
          </button>
          {editor.isActive("table") && (
            <>
              <button
                type="button"
                onClick={addRowToTable}
                className="toolbar-item"
                title="Thêm hàng"
              >
                <span className="flex items-center justify-center w-full h-full text-xs font-medium">+H</span>
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().deleteRow().run()}
                className="toolbar-item"
                title="Xóa hàng"
              >
                <span className="flex items-center justify-center w-full h-full text-xs font-medium">-H</span>
              </button>
              <button
                type="button"
                onClick={addColumnToTable}
                className="toolbar-item"
                title="Thêm cột"
              >
                <span className="flex items-center justify-center w-full h-full text-xs font-medium">+C</span>
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().deleteColumn().run()}
                className="toolbar-item"
                title="Xóa cột"
              >
                <span className="flex items-center justify-center w-full h-full text-xs font-medium">-C</span>
              </button>
              <button
                type="button"
                onClick={deleteTable}
                className="toolbar-item text-red-500"
                title="Xóa bảng"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}

          {mode === 'full' && (
            <>
              <div className="separator" />
              <div className="dropdown">
                <button type="button" className="toolbar-item" title="Line height">
                  <LineHeight size={16} />
                </button>
                <div className="dropdown-content">
                  {["1", "1.2", "1.5", "2", "2.5", "3"].map((height) => (
                    <button
                      key={height}
                      onClick={() => setLineHeight(height)}
                      className={editor.isActive("lineHeight", { lineHeight: height }) ? "is-active" : ""}
                    >
                      {height}
                    </button>
                  ))}
                </div>
              </div>

              <div className="separator" />

              <button
                type="button"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="toolbar-item"
                title="Undo"
              >
                <Undo size={16} />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="toolbar-item"
                title="Redo"
              >
                <Redo size={16} />
              </button>
            </>
          )}
          </>}
        </div>
      )}

      {/* Tree structure builder panel */}
      {showTreeBuilder && (
        <TreeBuilderPanel
          onInsert={(tree) => {
            // Insert tree as a fenced code block in the editor
            editor.chain().focus().insertContent({
              type: 'codeBlock',
              content: [{ type: 'text', text: tree }],
            }).run()
            setShowTreeBuilder(false)
          }}
          onClose={() => setShowTreeBuilder(false)}
        />
      )}

      {/* Inline image URL input panel — rendered outside toolbar to avoid flex layout issues */}
      {showImageUrlInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
          <input
            type="url"
            value={imageUrlValue}
            onChange={e => setImageUrlValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); addImageFromUrl(); }
              if (e.key === 'Escape') { setShowImageUrlInput(false); setImageUrlValue(''); }
            }}
            placeholder="https://example.com/image.png"
            className="flex-1 text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-300"
            autoFocus
          />
          <button
            type="button"
            onClick={addImageFromUrl}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Chèn
          </button>
          <button
            type="button"
            onClick={() => { setShowImageUrlInput(false); setImageUrlValue(''); }}
            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Hủy
          </button>
        </div>
      )}

      {editorMode === 'markdown' ? (
        <textarea
          className="markdown-editor"
          value={markdownValue}
          onChange={(e) => handleMarkdownChange(e.target.value)}
          placeholder="Write Markdown here..."
          spellCheck={false}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
      
      {/* Symbol picker popup — fixed position to escape overflow:hidden clipping */}
      {showSymbolPicker && symbolPickerPos && (
        <div
          ref={symbolPickerRef}
          className="symbol-picker-popup"
          style={{ position: 'fixed', top: symbolPickerPos.top, left: symbolPickerPos.left, zIndex: 9999 }}
        >
          <div className="symbol-label">Tree symbols</div>
          {[
            { symbol: '├──', label: '├──' },
            { symbol: '└──', label: '└──' },
            { symbol: '│',   label: '│' },
            { symbol: '├─',  label: '├─' },
            { symbol: '└─',  label: '└─' },
            { symbol: '───', label: '───' },
            { symbol: '/',   label: '/' },
          ].map(({ symbol, label }) => (
            <button key={label} type="button" onClick={() => insertSymbol(symbol)}>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Mention popup */}
      {mentionPopup.show && (
        <div 
          className="mention-popup"
          style={{
            position: 'fixed',
            left: `${mentionPopup.position.x}px`,
            top: `${mentionPopup.position.y}px`,
            zIndex: 9999
          }}
        >
          {mentionPopup.items.length > 0 ? (
            mentionPopup.items.map((item, index) => (
              <div
                key={item.id}
                className={`mention-item ${index === currentSelectedIndexRef.current ? 'selected' : ''}`}
                onClick={() => {
                  // Đánh dấu đang xử lý click
                  isProcessingEnterRef.current = true;
                  console.log('Clicked item:', item);
                  
                  // Xử lý mention ngay lập tức
                  handleMentionSelect(item);
                }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white" 
                  style={{
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'][item.username.charCodeAt(0) % 6]
                  }}
                >
                  {item.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{item.username}</div>
                  <div className="text-xs text-gray-500">@{item.username}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 text-gray-500">Không tìm thấy kết quả</div>
          )}
        </div>
      )}
    </div>
  )
}

export const RichTextEditor = forwardRef<any, RichTextEditorProps>(RichTextEditorComponent);
RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;