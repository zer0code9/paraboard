"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Toggle } from "@/components/ui/toggle"
import { Pencil, Square, Circle, Type, Minus, Grid, Trash2, Download, Move, Eraser } from "lucide-react"

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

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ctx || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (tool === "move") {
      const clickedElement = elements.find((el) => isPointInElement(x, y, el))
      if (clickedElement) {
        setMovingElement(clickedElement)
        setMoveOffset({ x: x - (clickedElement as Shape).startX, y: y - (clickedElement as Shape).startY })
      }
      return
    }

    if (tool === "eraser") {
      eraseElements(x, y)
      return
    }

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

    if (tool === "move" && movingElement) {
      const newX = x - moveOffset.x
      const newY = y - moveOffset.y
      setElements((prev) =>
        prev.map((el) =>
          el.id === movingElement.id
            ? {
                ...el,
                startX: newX,
                startY: newY,
                endX: newX + (el as Shape).endX - (el as Shape).startX,
                endY: newY + (el as Shape).endY - (el as Shape).startY,
              }
            : el,
        ),
      )
      return
    }

    if (tool === "eraser") {
      eraseElements(x, y)
      return
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
        const radius = Math.min(10, Math.abs(width) / 4, Math.abs(height) / 4)
        ctx.beginPath()
        ctx.moveTo(element.startX + radius, element.startY)
        ctx.lineTo(element.endX - radius, element.startY)
        ctx.quadraticCurveTo(element.endX, element.startY, element.endX, element.startY + radius)
        ctx.lineTo(element.endX, element.endY - radius)
        ctx.quadraticCurveTo(element.endX, element.endY, element.endX - radius, element.endY)
        ctx.lineTo(element.startX + radius, element.endY)
        ctx.quadraticCurveTo(element.startX, element.endY, element.startX, element.endY - radius)
        ctx.lineTo(element.startX, element.startY + radius)
        ctx.quadraticCurveTo(element.startX, element.startY, element.startX + radius, element.startY)
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
  }, [ctx, elements, showGrid, drawGrid])

  const isPointInElement = (x: number, y: number, element: DrawingElement) => {
    if (element.type === "text") {
      return x >= element.x && x <= element.x + 50 && y >= element.y - element.fontSize && y <= element.y
    } else {
      const minX = Math.min(element.startX, element.endX)
      const maxX = Math.max(element.startX, element.endX)
      const minY = Math.min(element.startY, element.endY)
      const maxY = Math.max(element.startY, element.endY)
      return x >= minX && x <= maxX && y >= minY && y <= maxY
    }
  }

  const eraseElements = (x: number, y: number) => {
    setElements((prev) =>
      prev.filter((el) => {
        if (el.type === "pen" && el.points) {
          return !el.points.some((point) => Math.abs(point.x - x) < 5 && Math.abs(point.y - y) < 5)
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

    const clickedElement = elements.find((el) => el.type === "text" && isPointInElement(x, y, el))
    if (clickedElement && clickedElement.type === "text") {
      setEditingTextId(clickedElement.id)
      setTextInput(clickedElement.content)
      setTextPosition({ x: clickedElement.x, y: clickedElement.y })
      setIsAddingText(true)
      setTimeout(() => textInputRef.current?.focus(), 0)
    }
  }

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

          <Button variant="outline" size="icon" onClick={clearCanvas} className="h-9 w-9">
            <Trash2 className="h-5 w-5" />
          </Button>

          <Button variant="outline" size="icon" onClick={downloadCanvas} className="h-9 w-9">
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
