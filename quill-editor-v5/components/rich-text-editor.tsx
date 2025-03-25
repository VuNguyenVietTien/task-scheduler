"use client"

import { useState, useCallback, useRef, useEffect } from "react"
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
import { Node } from "@tiptap/core"
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
            parseHTML: (element) => element.style.lineHeight,
            renderHTML: (attributes) => {
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
      setLineHeight:
        (lineHeight) =>
        ({ commands }) => {
          return this.options.types.every((type) => commands.updateAttributes(type, { lineHeight }))
        },
    }
  },
})

// Custom resizable image component
const ResizableImageComponent = ({ node, updateAttributes, selected, editor, extension, getPos }) => {
  const imageRef = useRef(null)
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
    (e, direction) => {
      e.preventDefault()
      e.stopPropagation()

      const startSize = {
        width: imageRef.current.clientWidth,
        height: imageRef.current.clientHeight,
      }
      const startPos = { x: e.clientX, y: e.clientY }
      setResizing(true)

      const handleMouseMove = (moveEvent) => {
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
              <button className="p-1 rounded hover:bg-gray-200" title="Move image">
                <MoveHorizontal size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// Custom Image extension with resizable view
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "auto",
        renderHTML: (attributes) => ({
          width: attributes.width,
        }),
      },
      height: {
        default: "auto",
        renderHTML: (attributes) => ({
          height: attributes.height,
        }),
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent)
  },
})

export default function RichTextEditor() {
  const [imageUrl, setImageUrl] = useState("")
  const editorContainerRef = useRef(null)

  // Handle drag over for the editor
  const handleDragOver = (e) => {
    e.preventDefault()
  }

  // Handle drop for the editor
  const handleDrop = (e) => {
    e.preventDefault()

    // Handle files (images)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (event) => {
          if (editor && event.target?.result) {
            const result = event.target.result.toString()
            editor.chain().focus().setImage({ src: result }).run()
          }
        }
        reader.readAsDataURL(file)
      }
      return
    }

    // Handle dragged content from within the editor
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"))
      if (data.type === "image" && editor) {
        const { clientX, clientY } = e
        const editorPos = editorContainerRef.current.getBoundingClientRect()
        const pos = editor.view.posAtCoords({ left: clientX, top: clientY })

        if (pos) {
          editor.chain().focus().setNodeSelection(pos.pos).run()
          editor.chain().focus().setImage(data.attrs).run()
        }
      }
    } catch (error) {
      // Not JSON data, ignore
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      ResizableImage.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: "resizable-image",
        },
      }),
      Table.configure({
        resizable: true,
        handleWidth: 5,
        cellMinWidth: 50,
        lastColumnResizable: true,
        HTMLAttributes: {
          class: "resizable-table",
        },
      }),
      TableRow,
      TableHeader,
      TableCell.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            background: {
              default: null,
              parseHTML: (element) => element.getAttribute("data-background"),
              renderHTML: (attributes) => {
                if (!attributes.background) {
                  return {}
                }
                return {
                  "data-background": attributes.background,
                  style: `background-color: ${attributes.background}`,
                }
              },
            },
          }
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      LineHeightExtension.configure({
        types: ["heading", "paragraph"],
        lineHeights: ["1", "1.2", "1.5", "2", "2.5", "3"],
      }),
      Placeholder.configure({
        placeholder: "Write something...",
      }),
    ],
    content: `
      <h2>Welcome to the Enhanced Rich Text Editor!</h2>
      <p>This editor now supports:</p>
      <ul>
        <li>Text styling (bold, italic, underline)</li>
        <li>Resizable tables with drag & drop</li>
        <li>Resizable images with drag & drop</li>
        <li>Line spacing control</li>
        <li>Delete buttons for media</li>
      </ul>
      <p>Try dragging and dropping an image into the editor!</p>
    `,
  })

  const addImage = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"

    input.onchange = (event) => {
      if (input.files?.length) {
        const file = input.files[0]
        const reader = new FileReader()

        reader.onload = (e) => {
          const result = e.target?.result
          if (typeof result === "string" && editor) {
            editor.chain().focus().setImage({ src: result }).run()
          }
        }

        reader.readAsDataURL(file)
      }
    }

    input.click()
  }

  const addTable = () => {
    if (editor) {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    }
  }

  const deleteTable = () => {
    if (editor) {
      editor.chain().focus().deleteTable().run()
    }
  }

  const setLineHeight = (height) => {
    if (editor) {
      editor.chain().focus().setLineHeight(height).run()
    }
  }

  if (!editor) {
    return <div className="border rounded-lg p-4 h-[400px] flex items-center justify-center">Loading Editor...</div>
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-100 p-2 border-b flex flex-wrap gap-1 items-center">
        {/* Text formatting */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive("bold") ? "bg-gray-200" : ""}`}
          title="Bold"
        >
          <Bold size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive("italic") ? "bg-gray-200" : ""}`}
          title="Italic"
        >
          <Italic size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive("underline") ? "bg-gray-200" : ""}`}
          title="Underline"
        >
          <UnderlineIcon size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive("strike") ? "bg-gray-200" : ""}`}
          title="Strikethrough"
        >
          <Strikethrough size={18} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Text alignment */}
        <button
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: "left" }) ? "bg-gray-200" : ""}`}
          title="Align left"
        >
          <AlignLeft size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: "center" }) ? "bg-gray-200" : ""}`}
          title="Align center"
        >
          <AlignCenter size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: "right" }) ? "bg-gray-200" : ""}`}
          title="Align right"
        >
          <AlignRight size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: "justify" }) ? "bg-gray-200" : ""}`}
          title="Justify"
        >
          <AlignJustify size={18} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Line height */}
        <div className="relative group">
          <button className="p-2 rounded hover:bg-gray-200 flex items-center" title="Line spacing">
            <LineHeight size={18} />
          </button>
          <div className="absolute hidden group-hover:block top-full left-0 bg-white border rounded shadow-lg p-2 z-10">
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setLineHeight("1")}
                className="px-2 py-1 text-left hover:bg-gray-100 rounded text-sm"
              >
                Single
              </button>
              <button
                onClick={() => setLineHeight("1.2")}
                className="px-2 py-1 text-left hover:bg-gray-100 rounded text-sm"
              >
                1.2
              </button>
              <button
                onClick={() => setLineHeight("1.5")}
                className="px-2 py-1 text-left hover:bg-gray-100 rounded text-sm"
              >
                1.5
              </button>
              <button
                onClick={() => setLineHeight("2")}
                className="px-2 py-1 text-left hover:bg-gray-100 rounded text-sm"
              >
                Double
              </button>
              <button
                onClick={() => setLineHeight("2.5")}
                className="px-2 py-1 text-left hover:bg-gray-100 rounded text-sm"
              >
                2.5
              </button>
              <button
                onClick={() => setLineHeight("3")}
                className="px-2 py-1 text-left hover:bg-gray-100 rounded text-sm"
              >
                Triple
              </button>
            </div>
          </div>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Lists */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive("bulletList") ? "bg-gray-200" : ""}`}
          title="Bullet list"
        >
          <List size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-gray-200 ${editor.isActive("orderedList") ? "bg-gray-200" : ""}`}
          title="Ordered list"
        >
          <ListOrdered size={18} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Headings */}
        <select
          onChange={(e) => {
            const value = e.target.value
            if (value === "paragraph") {
              editor.chain().focus().setParagraph().run()
            } else {
              editor
                .chain()
                .focus()
                .toggleHeading({ level: Number.parseInt(value.replace("h", "")) })
                .run()
            }
          }}
          className="p-1 rounded border bg-white"
          value={
            editor.isActive("heading", { level: 1 })
              ? "h1"
              : editor.isActive("heading", { level: 2 })
                ? "h2"
                : editor.isActive("heading", { level: 3 })
                  ? "h3"
                  : "paragraph"
          }
        >
          <option value="paragraph">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Text color */}
        <input
          type="color"
          onInput={(e) => {
            editor.chain().focus().setColor(e.currentTarget.value).run()
          }}
          className="w-8 h-8 p-0 border rounded cursor-pointer"
          title="Text color"
        />

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Media */}
        <button onClick={addImage} className="p-2 rounded hover:bg-gray-200" title="Insert image">
          <ImageIcon size={18} />
        </button>

        {/* Table dropdown */}
        <div className="relative group">
          <button className="p-2 rounded hover:bg-gray-200" title="Table options">
            <TableIcon size={18} />
          </button>
          <div className="absolute hidden group-hover:block top-full left-0 bg-white border rounded shadow-lg p-2 z-10">
            <div className="flex flex-col gap-1">
              <button
                onClick={addTable}
                className="px-2 py-1 text-left hover:bg-gray-100 rounded text-sm whitespace-nowrap"
              >
                Insert table
              </button>
              <button
                onClick={deleteTable}
                className="px-2 py-1 text-left hover:bg-gray-100 rounded text-sm whitespace-nowrap"
              >
                Delete table
              </button>
            </div>
          </div>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Undo/Redo */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-2 rounded hover:bg-gray-200 disabled:opacity-50"
          title="Undo"
        >
          <Undo size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-2 rounded hover:bg-gray-200 disabled:opacity-50"
          title="Redo"
        >
          <Redo size={18} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Clear */}
        <button
          onClick={() => editor.chain().focus().clearContent().run()}
          className="p-2 rounded hover:bg-gray-200"
          title="Clear content"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div ref={editorContainerRef} onDragOver={handleDragOver} onDrop={handleDrop} className="editor-container">
        <EditorContent editor={editor} className="prose max-w-none p-4" />
      </div>

      <style jsx global>{`
        .ProseMirror {
          min-height: 300px;
          outline: none;
        }
        
        /* Adjust line spacing for all content */
        .ProseMirror p {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }
        
        /* Table styles with resize handles */
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 0;
          overflow: hidden;
          position: relative;
        }
        
        .ProseMirror td,
        .ProseMirror th {
          min-width: 1em;
          border: 2px solid #ced4da;
          padding: 3px 5px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        
        .ProseMirror th {
          font-weight: bold;
          background-color: #f8f9fa;
        }
        
        .ProseMirror .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          background: rgba(200, 200, 255, 0.4);
          pointer-events: none;
        }
        
        /* Column resize handle styles */
        .tableColumnResizer {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          background-color: #adf;
          cursor: col-resize;
          z-index: 10;
        }
        
        .tableColumnResizer:hover,
        .tableColumnResizer.dragging {
          background-color: #68cef8;
        }
        
        /* Image styles */
        .ProseMirror img {
          max-width: 100%;
          height: auto;
        }
        
        .ProseMirror .resizable-image-wrapper {
          display: inline-block;
          position: relative;
        }
        
        /* Placeholder (at the top) */
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
        
        /* Drag and drop styles */
        .ProseMirror .draggable-item {
          cursor: move;
        }
        
        .ProseMirror .drag-handle {
          position: absolute;
          left: -20px;
          top: 0;
          width: 20px;
          height: 20px;
          opacity: 0;
          transition: opacity 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #adb5bd;
        }
        
        .ProseMirror .draggable-item:hover .drag-handle {
          opacity: 1;
        }
      `}</style>
    </div>
  )
}

