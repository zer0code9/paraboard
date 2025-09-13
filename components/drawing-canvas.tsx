"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Toggle } from "@/components/ui/toggle"
import { Pencil, Square, Circle, Type, Minus, Grid, Trash2, Download, Move, Eraser, Copy } from "lucide-react"

type Tool = "pen" | "line" | "rectangle" | "circle" | "text" | "move" | "eraser"
type Shape = {
  id: string
  type: "pen" | "line" | "rectangle" | "circle"
  startX: number
  startY: number
  endX: number
  endY: number
  lineWidth: number
  points?: { x: number; y: number }[]
}
type TextElement = { id: string; type: "text"; x: number; y: number; content: string; fontSize: number }
type DrawingElement = Shape | TextElement

export default function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<Tool>("pen")
  const [lineWidth, setLineWidth] = useState(2)
  const [showGrid, setShowGrid] = useState(false)
  const [textInput, setTextInput] = useState("")
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 })
  const [isAddingText, setIsAddingText] = useState(false)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const [elements, setElements] = useState<DrawingElement[]>([])
  const [movingElement, setMovingElement] = useState<DrawingElement | null>(null)
  const [moveOffset, setMoveOffset] = useState({ x: 0, y: 0 })
  const [selectedElement, setSelectedElement] = useState<DrawingElement | null>(null)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [copiedElement, setCopiedElement] = useState<DrawingElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const context = canvas.getContext("2d")
    if (context) {
      context.lineCap = "round"
      context.lineJoin = "round"
      setCtx(context)
    }

    const handleResize = () => {
      if (!canvas || !context) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      redrawCanvas()
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    redrawCanvas()
  }, [elements]) // Removed showGrid from dependencies

  const drawGrid = useCallback(() => {
    if (!ctx || !canvasRef.current) return

    const canvas = canvasRef.current
    const gridSize = 20

    ctx.save()
    ctx.strokeStyle = "#e0e0e0"
    ctx.lineWidth = 0.5

    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }

    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    ctx.restore()
  }, [ctx])

  const getResizeHandle = (x: number, y: number, element: DrawingElement): string | null => {
    if (element.type === "text") return null

    const tolerance = 8

    if (element.type === "circle") {
      const centerX = element.startX
      const centerY = element.startY
      const radius = Math.sqrt(Math.pow(element.endX - element.startX, 2) + Math.pow(element.endY - element.startY, 2))

      // Check if click is near any of the 8 handle positions on the circle
      const handles = [
        { x: centerX, y: centerY - radius, handle: "n" },
        { x: centerX + radius * Math.cos(Math.PI / 4), y: centerY - radius * Math.sin(Math.PI / 4), handle: "ne" },
        { x: centerX + radius, y: centerY, handle: "e" },
        { x: centerX + radius * Math.cos(Math.PI / 4), y: centerY + radius * Math.sin(Math.PI / 4), handle: "se" },
        { x: centerX, y: centerY + radius, handle: "s" },
        { x: centerX - radius * Math.cos(Math.PI / 4), y: centerY + radius * Math.sin(Math.PI / 4), handle: "sw" },
        { x: centerX - radius, y: centerY, handle: "w" },
        { x: centerX - radius * Math.cos(Math.PI / 4), y: centerY - radius * Math.sin(Math.PI / 4), handle: "nw" },
      ]

      for (const handle of handles) {
        if (Math.abs(x - handle.x) < tolerance && Math.abs(y - handle.y) < tolerance) {
          return handle.handle
        }
      }
      return null
    }

    // For rectangles and lines
    const minX = Math.min(element.startX, element.endX)
    const maxX = Math.max(element.startX, element.endX)
    const minY = Math.min(element.startY, element.endY)
    const maxY = Math.max(element.startY, element.endY)

    const handleTolerance = 4

    // Check corners
    if (Math.abs(x - minX) < handleTolerance && Math.abs(y - minY) < handleTolerance) return "nw"
    if (Math.abs(x - maxX) < handleTolerance && Math.abs(y - minY) < handleTolerance) return "ne"
    if (Math.abs(x - minX) < handleTolerance && Math.abs(y - maxY) < handleTolerance) return "sw"
    if (Math.abs(x - maxX) < handleTolerance && Math.abs(y - maxY) < handleTolerance) return "se"

    // Check edges
    if (Math.abs(x - minX) < handleTolerance && y > minY + handleTolerance && y < maxY - handleTolerance) return "w"
    if (Math.abs(x - maxX) < handleTolerance && y > minY + handleTolerance && y < maxY - handleTolerance) return "e"
    if (Math.abs(y - minY) < handleTolerance && x > minX + handleTolerance && x < maxX - handleTolerance) return "n"
    if (Math.abs(y - maxY) < handleTolerance && x > minX + handleTolerance && x < maxX - handleTolerance) return "s"

    return null
  }

  const drawResizeHandles = useCallback(
    (element: DrawingElement) => {
      if (!ctx || element.type === "text" || element.type === "pen") return

      const handleSize = 6

      ctx.fillStyle = "#3b82f6"
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 1

      if (element.type === "circle") {
        const centerX = element.startX
        const centerY = element.startY
        const radius = Math.sqrt(
          Math.pow(element.endX - element.startX, 2) + Math.pow(element.endY - element.startY, 2),
        )

        // Draw handles on the circle circumference
        const handles = [
          { x: centerX, y: centerY - radius }, // n
          { x: centerX + radius * Math.cos(Math.PI / 4), y: centerY - radius * Math.sin(Math.PI / 4) }, // ne
          { x: centerX + radius, y: centerY }, // e
          { x: centerX + radius * Math.cos(Math.PI / 4), y: centerY + radius * Math.sin(Math.PI / 4) }, // se
          { x: centerX, y: centerY + radius }, // s
          { x: centerX - radius * Math.cos(Math.PI / 4), y: centerY + radius * Math.sin(Math.PI / 4) }, // sw
          { x: centerX - radius, y: centerY }, // w
          { x: centerX - radius * Math.cos(Math.PI / 4), y: centerY - radius * Math.sin(Math.PI / 4) }, // nw
        ]

        handles.forEach((handle) => {
          ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
          ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
        })
      } else {
        // For rectangles and lines
        const minX = Math.min(element.startX, element.endX)
        const maxX = Math.max(element.startX, element.endX)
        const minY = Math.min(element.startY, element.endY)
        const maxY = Math.max(element.startY, element.endY)

        const handles = [
          { x: minX, y: minY }, // nw
          { x: maxX, y: minY }, // ne
          { x: minX, y: maxY }, // sw
          { x: maxX, y: maxY }, // se
          { x: minX, y: (minY + maxY) / 2 }, // w
          { x: maxX, y: (minY + maxY) / 2 }, // e
          { x: (minX + maxX) / 2, y: minY }, // n
          { x: (minX + maxX) / 2, y: maxY }, // s
        ]

        handles.forEach((handle) => {
          ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
          ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
        })
      }
    },
    [ctx],
  )

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ctx || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (tool === "move") {
      // Check if clicking on resize handle first
      if (selectedElement) {
        const handle = getResizeHandle(x, y, selectedElement)
        if (handle) {
          setResizeHandle(handle)
          return
        }
      }

      const clickedElement = elements.find((el) => isPointInElement(x, y, el))
      if (clickedElement) {
        setSelectedElement(clickedElement)
        setMovingElement(clickedElement)
        setMoveOffset({ x: x - (clickedElement as Shape).startX, y: y - (clickedElement as Shape).startY })
      } else {
        setSelectedElement(null)
      }
      return
    }

    if (tool === "eraser") {
      eraseElements(x, y)
      return
    }

    setSelectedElement(null)
    setIsDrawing(true)

    if (tool === "text") {
      setTextPosition({ x, y })
      setIsAddingText(true)
      setTimeout(() => textInputRef.current?.focus(), 0)
    } else {
      const newElement: Shape = {
        id: Date.now().toString(),
        type: tool === "pen" ? "pen" : tool,
        startX: x,
        startY: y,
        endX: x,
        endY: y,
        lineWidth,
        points: tool === "pen" ? [{ x, y }] : undefined,
      }
      setElements((prev) => [...prev, newElement])
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ctx || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (tool === "move") {
      if (resizeHandle && selectedElement) {
        // Handle resizing
        setElements((prev) =>
          prev.map((el) => {
            if (el.id === selectedElement.id && el.type !== "text" && el.type !== "pen") {
              if (el.type === "circle") {
                // For circles, calculate new radius based on distance from center to mouse
                const centerX = el.startX
                const centerY = el.startY
                const newRadius = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2))

                // Update endX and endY to represent the new radius
                const updatedElement = {
                  ...el,
                  endX: centerX + newRadius,
                  endY: centerY,
                }

                setSelectedElement(updatedElement)
                return updatedElement
              } else {
                // For rectangles and lines
                const minX = Math.min(el.startX, el.endX)
                const maxX = Math.max(el.startX, el.endX)
                const minY = Math.min(el.startY, el.endY)
                const maxY = Math.max(el.startY, el.endY)

                let newStartX = el.startX
                let newStartY = el.startY
                let newEndX = el.endX
                let newEndY = el.endY

                switch (resizeHandle) {
                  case "nw":
                    newStartX = el.startX < el.endX ? x : el.endX
                    newStartY = el.startY < el.endY ? y : el.endY
                    newEndX = el.startX < el.endX ? el.endX : x
                    newEndY = el.startY < el.endY ? el.endY : y
                    break
                  case "ne":
                    if (el.startX < el.endX) {
                      // Normal orientation
                      newStartX = el.startX
                      newStartY = y
                      newEndX = x
                      newEndY = el.endY
                    } else {
                      // Flipped horizontally
                      newStartX = x
                      newStartY = y
                      newEndX = el.startX
                      newEndY = el.endY
                    }
                    break
                  case "sw":
                    newStartX = el.startX < el.endX ? x : el.endX
                    newStartY = el.startY < el.endY ? el.startY : y
                    newEndX = el.startX < el.endX ? el.endX : x
                    newEndY = el.startY < el.endY ? y : el.startY
                    break
                  case "se":
                    newStartX = el.startX < el.endX ? el.startX : x
                    newStartY = el.startY < el.endY ? el.startY : y
                    newEndX = el.startX < el.endX ? x : el.startX
                    newEndY = el.startY < el.endY ? y : el.startY
                    break
                  case "w":
                    newStartX = el.startX < el.endX ? x : el.endX
                    newEndX = el.startX < el.endX ? el.endX : x
                    break
                  case "e":
                    newStartX = el.startX < el.endX ? el.startX : x
                    newEndX = el.startX < el.endX ? x : el.startX
                    break
                  case "n":
                    newStartY = el.startY < el.endY ? y : el.endY
                    newEndY = el.startY < el.endY ? el.endY : y
                    break
                  case "s":
                    newStartY = el.startY < el.endY ? el.startY : y
                    newEndY = el.startY < el.endY ? y : el.endY
                    break
                }

                const updatedElement = { ...el, startX: newStartX, startY: newStartY, endX: newEndX, endY: newEndY }

                // Update selectedElement to reflect the changes
                setSelectedElement(updatedElement)

                return updatedElement
              }
            }
            return el
          }),
        )
        return
      }

      if (movingElement) {
        const newX = x - moveOffset.x
        const newY = y - moveOffset.y
        setElements((prev) =>
          prev.map((el) => {
            if (el.id === movingElement.id) {
              const updatedElement = {
                ...el,
                startX: newX,
                startY: newY,
                endX: newX + (el as Shape).endX - (el as Shape).startX,
                endY: newY + (el as Shape).endY - (el as Shape).startY,
              }

              // Update selectedElement to reflect the changes
              setSelectedElement(updatedElement)

              return updatedElement
            }
            return el
          }),
        )
        return
      }
    }

    if (!isDrawing) return

    setElements((prev) => {
      const lastElement = prev[prev.length - 1]
      if (lastElement && lastElement.type !== "text") {
        if (lastElement.type === "pen" && lastElement.points) {
          return [...prev.slice(0, -1), { ...lastElement, points: [...lastElement.points, { x, y }] }]
        } else {
          return [...prev.slice(0, -1), { ...lastElement, endX: x, endY: y }]
        }
      }
      return prev
    })
  }

  const finishDrawing = () => {
    setIsDrawing(false)
    setMovingElement(null)
    setResizeHandle(null)
  }

  const addTextToCanvas = () => {
    if (!textInput) return

    if (editingTextId) {
      setElements((prev) =>
        prev.map((el) => (el.id === editingTextId ? ({ ...el, content: textInput } as TextElement) : el)),
      )
      setEditingTextId(null)
    } else {
      const newElement: TextElement = {
        id: Date.now().toString(),
        type: "text",
        x: textPosition.x,
        y: textPosition.y,
        content: textInput,
        fontSize: lineWidth * 8,
      }
      setElements((prev) => [...prev, newElement])
    }

    setTextInput("")
    setIsAddingText(false)
  }

  const redrawCanvas = useCallback(() => {
    if (!ctx || !canvasRef.current) return

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

    if (showGrid) {
      drawGrid()
    }

    elements.forEach((element) => {
      ctx.strokeStyle = "black"
      ctx.fillStyle = "black"
      ctx.lineWidth = element.lineWidth

      if (element.type === "pen" && element.points) {
        ctx.beginPath()
        ctx.moveTo(element.points[0].x, element.points[0].y)
        element.points.forEach((point) => {
          ctx.lineTo(point.x, point.y)
        })
        ctx.stroke()
      } else if (element.type === "line") {
        ctx.beginPath()
        ctx.moveTo(element.startX, element.startY)
        ctx.lineTo(element.endX, element.endY)
        ctx.stroke()
      } else if (element.type === "rectangle") {
        const width = element.endX - element.startX
        const height = element.endY - element.startY

        const x = Math.min(element.startX, element.endX)
        const y = Math.min(element.startY, element.endY)
        const w = Math.abs(width)
        const h = Math.abs(height)

        const radius = Math.min(10, w / 4, h / 4)

        ctx.beginPath()
        ctx.moveTo(x + radius, y)
        ctx.lineTo(x + w - radius, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
        ctx.lineTo(x + w, y + h - radius)
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
        ctx.lineTo(x + radius, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
        ctx.lineTo(x, y + radius)
        ctx.quadraticCurveTo(x, y, x + radius, y)
        ctx.closePath()
        ctx.stroke()
      } else if (element.type === "circle") {
        const radius = Math.sqrt(
          Math.pow(element.endX - element.startX, 2) + Math.pow(element.endY - element.startY, 2),
        )
        ctx.beginPath()
        ctx.arc(element.startX, element.startY, radius, 0, 2 * Math.PI)
        ctx.stroke()
      } else if (element.type === "text") {
        ctx.font = `${element.fontSize}px Arial`
        ctx.fillText(element.content, element.x, element.y)
      }
    })

    // Draw resize handles for selected element
    if (selectedElement && tool === "move") {
      drawResizeHandles(selectedElement)
    }
  }, [ctx, elements, showGrid, drawGrid, selectedElement, tool, drawResizeHandles])

  const isPointInElement = (x: number, y: number, element: DrawingElement) => {
    if (element.type === "text") {
      return x >= element.x && x <= element.x + 50 && y >= element.y - element.fontSize && y <= element.y
    } else if (element.type === "circle") {
      // For circles, check if point is within the circle
      const centerX = element.startX
      const centerY = element.startY
      const radius = Math.sqrt(Math.pow(element.endX - element.startX, 2) + Math.pow(element.endY - element.startY, 2))
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2))
      return distance <= radius + 5 // Add 5px padding for easier selection
    } else {
      // Handle negative dimensions properly for rectangles and lines
      const minX = Math.min(element.startX, element.endX)
      const maxX = Math.max(element.startX, element.endX)
      const minY = Math.min(element.startY, element.endY)
      const maxY = Math.max(element.startY, element.endY)

      // Add some padding for better selection
      const padding = 5
      return x >= minX - padding && x <= maxX + padding && y >= minY - padding && y <= maxY + padding
    }
  }

  const eraseElements = (x: number, y: number) => {
    setElements((prev) =>
      prev.filter((el) => {
        if (el.type === "pen" && el.points) {
          // For pen strokes, check if click is close to any point in the path
          return !el.points.some((point) => {
            const distance = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2))
            return distance < 10 // 10 pixel tolerance
          })
        } else {
          return !isPointInElement(x, y, el)
        }
      }),
    )
  }

  const clearCanvas = () => {
    setElements([])
  }

  const downloadCanvas = () => {
    if (!canvasRef.current) return

    const link = document.createElement("a")
    link.download = "drawing.png"
    link.href = canvasRef.current.toDataURL("image/png")
    link.click()
  }

  const handleToolChange = (newTool: Tool) => {
    if (tool === "text" && isAddingText) {
      setIsAddingText(false)
      setTextInput("")
    }
    setTool(newTool)
  }

  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if right-clicking on text for editing
    const clickedElement = elements.find((el) => el.type === "text" && isPointInElement(x, y, el))
    if (clickedElement && clickedElement.type === "text") {
      setEditingTextId(clickedElement.id)
      setTextInput(clickedElement.content)
      setTextPosition({ x: clickedElement.x, y: clickedElement.y })
      setIsAddingText(true)
      setTimeout(() => textInputRef.current?.focus(), 0)
    } else if (copiedElement) {
      // Paste copied element at cursor position
      pasteElement(x, y)
    }
  }

  const copyElement = () => {
    if (selectedElement) {
      setCopiedElement(selectedElement)
    }
  }

  const pasteElement = (x: number, y: number) => {
    if (!copiedElement) return

    const newElement: DrawingElement = {
      ...copiedElement,
      id: Date.now().toString(),
    }

    if (newElement.type === "text") {
      newElement.x = x
      newElement.y = y
    } else {
      const width = (newElement as Shape).endX - (newElement as Shape).startX
      const height = (newElement as Shape).endY - (newElement as Shape).startY
      ;(newElement as Shape).startX = x
      ;(newElement as Shape).startY = y
      ;(newElement as Shape).endX = x + width
      ;(newElement as Shape).endY = y + height
    }

    setElements((prev) => [...prev, newElement])
    setSelectedElement(newElement)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "c" && selectedElement) {
          e.preventDefault()
          copyElement()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedElement])

  return (
    <div className="relative h-full w-full">
      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-2 p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md">
        <div className="flex items-center gap-1 border-r pr-2">
          <Button
            variant={tool === "pen" ? "default" : "outline"}
            size="icon"
            onClick={() => handleToolChange("pen")}
            className="h-9 w-9"
          >
            <Pencil className="h-5 w-5" />
          </Button>
          <Button
            variant={tool === "line" ? "default" : "outline"}
            size="icon"
            onClick={() => handleToolChange("line")}
            className="h-9 w-9"
          >
            <Minus className="h-5 w-5" />
          </Button>
          <Button
            variant={tool === "rectangle" ? "default" : "outline"}
            size="icon"
            onClick={() => handleToolChange("rectangle")}
            className="h-9 w-9"
          >
            <Square className="h-5 w-5" />
          </Button>
          <Button
            variant={tool === "circle" ? "default" : "outline"}
            size="icon"
            onClick={() => handleToolChange("circle")}
            className="h-9 w-9"
          >
            <Circle className="h-5 w-5" />
          </Button>
          <Button
            variant={tool === "text" ? "default" : "outline"}
            size="icon"
            onClick={() => handleToolChange("text")}
            className="h-9 w-9"
          >
            <Type className="h-5 w-5" />
          </Button>
          <Button
            variant={tool === "move" ? "default" : "outline"}
            size="icon"
            onClick={() => handleToolChange("move")}
            className="h-9 w-9"
          >
            <Move className="h-5 w-5" />
          </Button>
          <Button
            variant={tool === "eraser" ? "default" : "outline"}
            size="icon"
            onClick={() => handleToolChange("eraser")}
            className="h-9 w-9"
          >
            <Eraser className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={copyElement}
            disabled={!selectedElement}
            className="h-9 w-9 bg-transparent"
            title="Copy selected element (Ctrl+C)"
          >
            <Copy className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2 border-r pr-2">
          <Slider
            value={[lineWidth]}
            min={1}
            max={20}
            step={1}
            onValueChange={(value) => setLineWidth(value[0])}
            className="w-32"
          />
        </div>

        <div className="flex items-center gap-1">
          <Toggle pressed={showGrid} onPressedChange={setShowGrid} aria-label="Toggle grid">
            <Grid className="h-4 w-4" />
          </Toggle>

          <Button variant="outline" size="icon" onClick={clearCanvas} className="h-9 w-9 bg-transparent">
            <Trash2 className="h-5 w-5" />
          </Button>

          <Button variant="outline" size="icon" onClick={downloadCanvas} className="h-9 w-9 bg-transparent">
            <Download className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Text input */}
      {isAddingText && (
        <div className="absolute z-20 flex" style={{ left: textPosition.x, top: textPosition.y }}>
          <input
            ref={textInputRef}
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addTextToCanvas()
              } else if (e.key === "Escape") {
                setIsAddingText(false)
                setTextInput("")
                setEditingTextId(null)
              }
            }}
            onBlur={addTextToCanvas}
            className="border border-gray-300 px-2 py-1 rounded"
            autoFocus
          />
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="cursor-crosshair"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={finishDrawing}
        onMouseLeave={finishDrawing}
        onContextMenu={handleCanvasContextMenu}
      />
    </div>
  )
}
