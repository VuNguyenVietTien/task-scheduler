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
import { Node, Editor, NodeType } from "@tiptap/core"
import type { NodeViewProps } from '@tiptap/react'
import type { ChainedCommands } from '@tiptap/react'
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

// Mở rộng ChainedCommands để thêm phương thức setLineHeight
declare module '@tiptap/react' {
  interface ChainedCommands {
    setLineHeight: (lineHeight: string) => ChainedCommands
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
    }
  },
})

// Interface cho ResizableImageComponent
interface ResizableImageProps extends NodeViewProps {
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
      editor.commands.deleteRange({ from: getPos(), to: getPos() + node.nodeSize })
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
    // Lấy attributes mặc định từ extension Image
    const defaultAttrs = {
      src: {
        default: null
      },
      alt: {
        default: null
      }
    };

    return {
      ...defaultAttrs,
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
    return ReactNodeViewRenderer(ResizableImageComponent)
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
}

// Main editor component with forwardRef
const RichTextEditorComponent: ForwardRefRenderFunction<any, RichTextEditorProps> = (
  { value, onChange, placeholder = "Viết nội dung...", mode = 'full', className = '', minHeight = '200px', readOnly = false },
  ref
) => {
  const [editorKey, setEditorKey] = useState(Date.now())
  const fileInputRef = useRef<HTMLInputElement>(null)
  
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
      // Cập nhật vị trí con trỏ khi người dùng di chuyển con trỏ
      const selection = editor.view.state.selection;
      lastCursorPositionRef.current = { from: selection.from, to: selection.to };
    },
  })

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

  // Add image via button click
  const addImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
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
    <div className={`rich-text-editor ${className}`} onDrop={handleDrop} onDragOver={handleDragOver}>
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
      `}</style>

      {!readOnly && (
        <div className="editor-toolbar">
          {mode === 'full' && (
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

          <button type="button" onClick={addImage} className="toolbar-item" title="Add image">
            <ImageIcon size={16} />
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
                onClick={addColumnToTable}
                className="toolbar-item"
                title="Thêm cột"
              >
                <span className="flex items-center justify-center w-full h-full text-xs font-medium">+C</span>
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
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}

export const RichTextEditor = forwardRef<any, RichTextEditorProps>(RichTextEditorComponent);
RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;