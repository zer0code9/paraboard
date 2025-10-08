"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Toggle } from "@/components/ui/toggle"
import {
  Pencil,
  Square,
  Circle,
  Type,
  Minus,
  Grid,
  Trash2,
  Download,
  Move,
  Eraser,
  Copy,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  ZoomIn,
  ZoomOut,
  Undo,
  Redo,
} from "lucide-react"

type Tool = "pen" | "line" | "rectangle" | "circle" | "text" | "move" | "eraser" | "select"
type Shape = {
  id: string
  type: "pen" | "line" | "rectangle" | "circle"
  startX: number
  startY: number
  endX: number
  endY: number
  lineWidth: number
  points?: { x: number; y: number }[]
  rotation?: number
  flipX?: boolean
  flipY?: boolean
}
type TextElement = {
  id: string
  type: "text"
  x: number
  y: number
  content: string
  fontSize: number
  rotation?: number
  flipX?: boolean
  flipY?: boolean
}
type DrawingElement = Shape | TextElement

interface HistoryState {
  elements: DrawingElement[]
  selectedElements: DrawingElement[]
}

export default function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<Tool>("pen")
  const [lineWidth, setLineWidth] = useState(2)
  const [showGrid, setShowGrid] = useState(false)
  const [gridSnap, setGridSnap] = useState(false)
  const [textInput, setTextInput] = useState("")
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 })
  const [isAddingText, setIsAddingText] = useState(false)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const [elements, setElements] = useState<DrawingElement[]>([])
  const [movingElement, setMovingElement] = useState<DrawingElement | null>(null)
  const [moveOffset, setMoveOffset] = useState({ x: 0, y: 0 })
  const [selectedElements, setSelectedElements] = useState<DrawingElement[]>([])
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [copiedElements, setCopiedElements] = useState<DrawingElement[]>([])
  const [selectionBox, setSelectionBox] = useState<{
    startX: number
    startY: number
    endX: number
    endY: number
  } | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [history, setHistory] = useState<HistoryState[]>([{ elements: [], selectedElements: [] }])
  const [historyIndex, setHistoryIndex] = useState(0)
  const gridSize = 20

  const handleZoom = useCallback(
    (delta: number, clientX?: number, clientY?: number) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const mouseX = clientX ?? rect.width / 2
      const mouseY = clientY ?? rect.height / 2

      // Convert mouse position to world coordinates before zoom
      const worldX = (mouseX - panOffset.x) / zoom
      const worldY = (mouseY - panOffset.y) / zoom

      const newZoom = Math.max(0.1, Math.min(10, zoom + delta))

      // Calculate new pan offset to keep the mouse position fixed
      const newPanX = mouseX - worldX * newZoom
      const newPanY = mouseY - worldY * newZoom

      setZoom(newZoom)
      setPanOffset({ x: newPanX, y: newPanY })
    },
    [zoom, panOffset],
  )

  // Save state to history
  const saveToHistory = useCallback(() => {
    const newState: HistoryState = {
      elements: [...elements],
      selectedElements: [...selectedElements],
    }
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newState)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [elements, selectedElements, history, historyIndex])

  // Undo function
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      setElements(prevState.elements)
      setSelectedElements(prevState.selectedElements)
      setHistoryIndex(historyIndex - 1)
    }
  }, [history, historyIndex])

  // Redo function
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1]
      setElements(nextState.elements)
      setSelectedElements(nextState.selectedElements)
      setHistoryIndex(historyIndex + 1)
    }
  }, [history, historyIndex])

  // Snap to grid function
  const snapToGrid = useCallback(
    (x: number, y: number) => {
      if (!gridSnap) return { x, y }
      return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize,
      }
    },
    [gridSnap, gridSize],
  )

  // Snap element to grid function
  const snapElementToGrid = useCallback(
    (element: DrawingElement) => {
      if (!gridSnap) return element

      if (element.type === "text") {
        const snapped = snapToGrid(element.x, element.y)
        return { ...element, x: snapped.x, y: snapped.y }
      } else {
        const snappedStart = snapToGrid(element.startX, element.startY)
        const snappedEnd = snapToGrid(element.endX, element.endY)

        const updatedElement = {
          ...element,
          startX: snappedStart.x,
          startY: snappedStart.y,
          endX: snappedEnd.x,
          endY: snappedEnd.y,
        }

        if (element.points) {
          updatedElement.points = element.points.map((point) => snapToGrid(point.x, point.y))
        }

        return updatedElement
      }
    },
    [gridSnap, snapToGrid],
  )

  // Transform coordinates based on zoom and pan
  const transformCoordinates = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return { x: 0, y: 0 }
      const rect = canvasRef.current.getBoundingClientRect()
      const x = (clientX - rect.left - panOffset.x) / zoom
      const y = (clientY - rect.top - panOffset.y) / zoom
      return snapToGrid(x, y)
    },
    [zoom, panOffset, snapToGrid],
  )

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
  }, [elements, selectedElements, showGrid, zoom, panOffset, selectionBox])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "c":
            e.preventDefault()
            copyElements()
            break
          case "v":
            e.preventDefault()
            pasteElements()
            break
          case "z":
            e.preventDefault()
            if (e.shiftKey) {
              redo()
            } else {
              undo()
            }
            break
          case "a":
            e.preventDefault()
            selectAll()
            break
          case "d":
            e.preventDefault()
            duplicateElements()
            break
          case "0":
            e.preventDefault()
            setZoom(1)
            setPanOffset({ x: 0, y: 0 })
            break
          case "=":
          case "+":
            e.preventDefault()
            handleZoom(0.2)
            break
          case "-":
            e.preventDefault()
            handleZoom(-0.2)
            break
        }
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelectedElements()
      }

      if (e.key === "Escape") {
        setSelectedElements([])
        setSelectionBox(null)
      }

      // Arrow keys for panning
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault()
        const panSpeed = e.shiftKey ? 100 : 20
        setPanOffset((prev) => {
          switch (e.key) {
            case "ArrowUp":
              return { ...prev, y: prev.y + panSpeed }
            case "ArrowDown":
              return { ...prev, y: prev.y - panSpeed }
            case "ArrowLeft":
              return { ...prev, x: prev.x + panSpeed }
            case "ArrowRight":
              return { ...prev, x: prev.x - panSpeed }
            default:
              return prev
          }
        })
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedElements, copiedElements, elements])

  const drawGrid = useCallback(() => {
    if (!ctx || !canvasRef.current) return

    const canvas = canvasRef.current

    ctx.save()
    ctx.scale(zoom, zoom)
    ctx.translate(panOffset.x / zoom, panOffset.y / zoom)

    ctx.strokeStyle = "#e0e0e0"
    ctx.lineWidth = 0.5 / zoom

    // Calculate visible area with extra padding for infinite feel
    const padding = 1000 // Extra padding for infinite canvas
    const startX = Math.floor((-panOffset.x / zoom - padding) / gridSize) * gridSize
    const endX = (Math.ceil((canvas.width - panOffset.x) / zoom + padding) / gridSize) * gridSize
    const startY = Math.floor((-panOffset.y / zoom - padding) / gridSize) * gridSize
    const endY = (Math.ceil((canvas.height - panOffset.y) / zoom + padding) / gridSize) * gridSize

    // Draw vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, startY)
      ctx.lineTo(x, endY)
      ctx.stroke()
    }

    // Draw horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(startX, y)
      ctx.lineTo(endX, y)
      ctx.stroke()
    }

    ctx.restore()
  }, [ctx, zoom, panOffset, gridSize])

  const getResizeHandle = (x: number, y: number, element: DrawingElement): string | null => {
    if (element.type === "text" || element.type === "pen") return null

    const tolerance = Math.max(8 / zoom, 4) // Minimum 4px, scales with zoom

    if (element.type === "circle") {
      const centerX = element.startX
      const centerY = element.startY
      const radius = Math.sqrt(Math.pow(element.endX - element.startX, 2) + Math.pow(element.endY - element.startY, 2))

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

    // For rectangles and lines - use actual coordinates, not normalized
    const startX = element.startX
    const startY = element.startY
    const endX = element.endX
    const endY = element.endY

    // Calculate handle positions based on actual coordinates
    const handles = [
      { x: startX, y: startY, handle: "nw" },
      { x: endX, y: startY, handle: "ne" },
      { x: startX, y: endY, handle: "sw" },
      { x: endX, y: endY, handle: "se" },
      { x: startX, y: (startY + endY) / 2, handle: "w" },
      { x: endX, y: (startY + endY) / 2, handle: "e" },
      { x: (startX + endX) / 2, y: startY, handle: "n" },
      { x: (startX + endX) / 2, y: endY, handle: "s" },
    ]

    // Check handles in order of priority (corners first, then edges)
    for (const handle of handles) {
      if (Math.abs(x - handle.x) < tolerance && Math.abs(y - handle.y) < tolerance) {
        return handle.handle
      }
    }

    return null
  }

  const drawResizeHandles = useCallback(
    (elements: DrawingElement[]) => {
      if (!ctx || elements.length === 0) return

      const handleSize = 6 / zoom

      ctx.save()
      ctx.scale(zoom, zoom)
      ctx.translate(panOffset.x / zoom, panOffset.y / zoom)

      ctx.fillStyle = "#3b82f6"
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 2 / zoom

      elements.forEach((element) => {
        if (element.type === "text" || element.type === "pen") return

        if (element.type === "circle") {
          const centerX = element.startX
          const centerY = element.startY
          const radius = Math.sqrt(
            Math.pow(element.endX - element.startX, 2) + Math.pow(element.endY - element.startY, 2),
          )

          const handles = [
            { x: centerX, y: centerY - radius },
            { x: centerX + radius * Math.cos(Math.PI / 4), y: centerY - radius * Math.sin(Math.PI / 4) },
            { x: centerX + radius, y: centerY },
            { x: centerX + radius * Math.cos(Math.PI / 4), y: centerY + radius * Math.sin(Math.PI / 4) },
            { x: centerX, y: centerY + radius },
            { x: centerX - radius * Math.cos(Math.PI / 4), y: centerY + radius * Math.sin(Math.PI / 4) },
            { x: centerX - radius, y: centerY },
            { x: centerX - radius * Math.cos(Math.PI / 4), y: centerY - radius * Math.sin(Math.PI / 4) },
          ]

          handles.forEach((handle) => {
            ctx.beginPath()
            ctx.arc(handle.x, handle.y, handleSize / 2, 0, 2 * Math.PI)
            ctx.fill()
            ctx.stroke()
          })
        } else {
          // For rectangles and lines - use actual coordinates
          const startX = element.startX
          const startY = element.startY
          const endX = element.endX
          const endY = element.endY

          const handles = [
            { x: startX, y: startY }, // nw
            { x: endX, y: startY }, // ne
            { x: startX, y: endY }, // sw
            { x: endX, y: endY }, // se
            { x: startX, y: (startY + endY) / 2 }, // w
            { x: endX, y: (startY + endY) / 2 }, // e
            { x: (startX + endX) / 2, y: startY }, // n
            { x: (startX + endX) / 2, y: endY }, // s
          ]

          handles.forEach((handle) => {
            ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
            ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
          })
        }
      })

      ctx.restore()
    },
    [ctx, zoom, panOffset],
  )

  const drawSelectionBox = useCallback(() => {
    if (!ctx || !selectionBox) return

    ctx.save()
    ctx.scale(zoom, zoom)
    ctx.translate(panOffset.x / zoom, panOffset.y / zoom)

    ctx.strokeStyle = "#3b82f6"
    ctx.setLineDash([5 / zoom, 5 / zoom])
    ctx.lineWidth = 1 / zoom
    ctx.strokeRect(
      selectionBox.startX,
      selectionBox.startY,
      selectionBox.endX - selectionBox.startX,
      selectionBox.endY - selectionBox.startY,
    )

    ctx.restore()
  }, [ctx, selectionBox, zoom, panOffset])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ctx || !canvasRef.current) return

    const { x, y } = transformCoordinates(e.clientX, e.clientY)

    // Handle middle mouse button for panning
    if (e.button === 1) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
      return
    }

    if (tool === "select") {
      // Check if clicking on a selected element's resize handle
      if (selectedElements.length > 0) {
        for (const element of selectedElements) {
          const handle = getResizeHandle(x, y, element)
          if (handle) {
            setResizeHandle(handle)
            return
          }
        }
      }

      // Check if clicking on an existing element
      const clickedElement = elements.find((el) => isPointInElement(x, y, el))

      if (clickedElement) {
        if (e.ctrlKey || e.metaKey) {
          // Multi-select with Ctrl/Cmd
          if (selectedElements.includes(clickedElement)) {
            setSelectedElements(selectedElements.filter((el) => el.id !== clickedElement.id))
          } else {
            setSelectedElements([...selectedElements, clickedElement])
          }
        } else if (!selectedElements.includes(clickedElement)) {
          setSelectedElements([clickedElement])
        }

        setMovingElement(clickedElement)
        setMoveOffset({ x: x - (clickedElement as Shape).startX, y: y - (clickedElement as Shape).startY })
      } else {
        // Start selection box
        if (!e.ctrlKey && !e.metaKey) {
          setSelectedElements([])
        }
        setSelectionBox({ startX: x, startY: y, endX: x, endY: y })
        setIsSelecting(true)
      }
      return
    }

    if (tool === "move") {
      if (selectedElements.length > 0) {
        for (const element of selectedElements) {
          const handle = getResizeHandle(x, y, element)
          if (handle) {
            setResizeHandle(handle)
            return
          }
        }
      }

      const clickedElement = elements.find((el) => isPointInElement(x, y, el))
      if (clickedElement) {
        if (!selectedElements.includes(clickedElement)) {
          setSelectedElements([clickedElement])
        }
        setMovingElement(clickedElement)
        setMoveOffset({ x: x - (clickedElement as Shape).startX, y: y - (clickedElement as Shape).startY })
      } else {
        setSelectedElements([])
      }
      return
    }

    if (tool === "eraser") {
      eraseElements(x, y)
      return
    }

    setSelectedElements([])
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
        rotation: 0,
        flipX: false,
        flipY: false,
      }
      setElements((prev) => [...prev, newElement])
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ctx || !canvasRef.current) return

    const { x, y } = transformCoordinates(e.clientX, e.clientY)

    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
      return
    }

    if (tool === "select" && isSelecting && selectionBox) {
      setSelectionBox({ ...selectionBox, endX: x, endY: y })
      return
    }

    if ((tool === "move" || tool === "select") && resizeHandle && selectedElements.length > 0) {
      // Enhanced professional reshaping
      setElements((prev) =>
        prev.map((el) => {
          const selectedElement = selectedElements.find((sel) => sel.id === el.id)
          if (selectedElement && el.type !== "text" && el.type !== "pen") {
            if (el.type === "circle") {
              const centerX = el.startX
              const centerY = el.startY

              // For circles, allow reshaping radius in any direction
              switch (resizeHandle) {
                case "n":
                  return { ...el, endX: el.startX, endY: el.startY - Math.abs(y - centerY) }
                case "ne":
                  const neRadius = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2))
                  return { ...el, endX: centerX + neRadius, endY: centerY }
                case "e":
                  return { ...el, endX: el.startX + Math.abs(x - centerX), endY: el.startY }
                case "se":
                  const seRadius = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2))
                  return { ...el, endX: centerX + seRadius, endY: centerY }
                case "s":
                  return { ...el, endX: el.startX, endY: el.startY + Math.abs(y - centerY) }
                case "sw":
                  const swRadius = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2))
                  return { ...el, endX: centerX + swRadius, endY: centerY }
                case "w":
                  return { ...el, endX: el.startX - Math.abs(x - centerX), endY: el.startY }
                case "nw":
                  const nwRadius = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2))
                  return { ...el, endX: centerX + nwRadius, endY: centerY }
                default:
                  return el
              }
            } else {
              // Enhanced reshaping for rectangles and lines - free-form reshaping
              let newStartX = el.startX
              let newStartY = el.startY
              let newEndX = el.endX
              let newEndY = el.endY

              switch (resizeHandle) {
                case "nw":
                  // Northwest corner - reshape both start points
                  newStartX = x
                  newStartY = y
                  break
                case "ne":
                  // Northeast corner - reshape start Y and end X
                  newStartY = y
                  newEndX = x
                  break
                case "sw":
                  // Southwest corner - reshape start X and end Y
                  newStartX = x
                  newEndY = y
                  break
                case "se":
                  // Southeast corner - reshape both end points
                  newEndX = x
                  newEndY = y
                  break
                case "w":
                  // West edge - reshape start X only
                  newStartX = x
                  break
                case "e":
                  // East edge - reshape end X only
                  newEndX = x
                  break
                case "n":
                  // North edge - reshape start Y only
                  newStartY = y
                  break
                case "s":
                  // South edge - reshape end Y only
                  newEndY = y
                  break
              }

              // Apply grid snapping if enabled
              if (gridSnap) {
                const snappedStart = snapToGrid(newStartX, newStartY)
                const snappedEnd = snapToGrid(newEndX, newEndY)
                newStartX = snappedStart.x
                newStartY = snappedStart.y
                newEndX = snappedEnd.x
                newEndY = snappedEnd.y
              }

              return { ...el, startX: newStartX, startY: newStartY, endX: newEndX, endY: newEndY }
            }
          }
          return el
        }),
      )

      // Update selected elements to reflect changes
      setSelectedElements((prev) =>
        prev.map((sel) => {
          const updated = elements.find((el) => el.id === sel.id)
          return updated || sel
        }),
      )
      return
    }

    if ((tool === "move" || tool === "select") && movingElement && selectedElements.length > 0) {
      const newX = x - moveOffset.x
      const newY = y - moveOffset.y

      // Calculate the delta from the moving element's current position
      const deltaX = newX - movingElement.startX
      const deltaY = newY - movingElement.startY

      setElements((prev) =>
        prev.map((el) => {
          if (selectedElements.some((sel) => sel.id === el.id)) {
            let updatedElement = { ...el }

            if (el.type === "text") {
              updatedElement.x = el.x + deltaX
              updatedElement.y = el.y + deltaY
            } else {
              updatedElement.startX = el.startX + deltaX
              updatedElement.startY = el.startY + deltaY
              updatedElement.endX = el.endX + deltaX
              updatedElement.endY = el.endY + deltaY

              if (el.points) {
                updatedElement.points = el.points.map((point) => ({
                  x: point.x + deltaX,
                  y: point.y + deltaY,
                }))
              }
            }

            // Apply grid snapping during movement if enabled
            if (gridSnap) {
              updatedElement = snapElementToGrid(updatedElement)
            }

            return updatedElement
          }
          return el
        }),
      )

      // Update selected elements and moving element references
      setSelectedElements((prev) =>
        prev.map((sel) => {
          const updated = elements.find((el) => el.id === sel.id)
          if (updated) {
            let newSel = { ...updated }
            if (newSel.type === "text") {
              newSel.x = updated.x + deltaX
              newSel.y = updated.y + deltaY
            } else {
              newSel.startX = updated.startX + deltaX
              newSel.startY = updated.startY + deltaY
              newSel.endX = updated.endX + deltaX
              newSel.endY = updated.endY + deltaY
              if (updated.points) {
                newSel.points = updated.points.map((point) => ({
                  x: point.x + deltaX,
                  y: point.y + deltaY,
                }))
              }
            }
            if (gridSnap) {
              newSel = snapElementToGrid(newSel)
            }
            return newSel
          }
          return sel
        }),
      )

      // Update the moving element reference
      if (movingElement.type === "text") {
        const newMovingElement = { ...movingElement, x: movingElement.x + deltaX, y: movingElement.y + deltaY }
        setMovingElement(gridSnap ? snapElementToGrid(newMovingElement) : newMovingElement)
      } else {
        const newMovingElement = {
          ...movingElement,
          startX: movingElement.startX + deltaX,
          startY: movingElement.startY + deltaY,
          endX: movingElement.endX + deltaX,
          endY: movingElement.endY + deltaY,
        }
        setMovingElement(gridSnap ? snapElementToGrid(newMovingElement) : newMovingElement)
      }
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

  const finishDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false)
      return
    }

    if (tool === "select" && isSelecting && selectionBox) {
      // Select elements within selection box
      const minX = Math.min(selectionBox.startX, selectionBox.endX)
      const maxX = Math.max(selectionBox.startX, selectionBox.endX)
      const minY = Math.min(selectionBox.startY, selectionBox.endY)
      const maxY = Math.max(selectionBox.startY, selectionBox.endY)

      const elementsInBox = elements.filter((el) => {
        if (el.type === "text") {
          return el.x >= minX && el.x <= maxX && el.y >= minY && el.y <= maxY
        } else {
          const elMinX = Math.min(el.startX, el.endX)
          const elMaxX = Math.max(el.startX, el.endX)
          const elMinY = Math.min(el.startY, el.endY)
          const elMaxY = Math.max(el.startY, el.endY)

          return elMinX >= minX && elMaxX <= maxX && elMinY >= minY && elMaxY <= maxY
        }
      })

      if (e.ctrlKey || e.metaKey) {
        setSelectedElements((prev) => [...prev, ...elementsInBox.filter((el) => !prev.includes(el))])
      } else {
        setSelectedElements(elementsInBox)
      }

      setSelectionBox(null)
      setIsSelecting(false)
    }

    if (isDrawing) {
      // Apply grid snapping to the last drawn element
      if (gridSnap && elements.length > 0) {
        const lastElement = elements[elements.length - 1]
        const snappedElement = snapElementToGrid(lastElement)
        setElements((prev) => [...prev.slice(0, -1), snappedElement])
      }
      saveToHistory()
    }

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
        rotation: 0,
        flipX: false,
        flipY: false,
      }
      setElements((prev) => [...prev, newElement])
      saveToHistory()
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

    ctx.save()
    ctx.scale(zoom, zoom)
    ctx.translate(panOffset.x / zoom, panOffset.y / zoom)

    elements.forEach((element) => {
      ctx.save()

      // Apply transformations
      if (element.rotation || element.flipX || element.flipY) {
        const centerX = element.type === "text" ? element.x : (element.startX + element.endX) / 2
        const centerY = element.type === "text" ? element.y : (element.startY + element.endY) / 2

        ctx.translate(centerX, centerY)
        if (element.rotation) ctx.rotate((element.rotation * Math.PI) / 180)
        if (element.flipX) ctx.scale(-1, 1)
        if (element.flipY) ctx.scale(1, -1)
        ctx.translate(-centerX, -centerY)
      }

      ctx.strokeStyle = "black"
      ctx.fillStyle = "black"
      ctx.lineWidth = element.lineWidth / zoom

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

        const radius = Math.min(10 / zoom, w / 4, h / 4)

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
        ctx.font = `${element.fontSize / zoom}px Arial`
        ctx.fillText(element.content, element.x, element.y)
      }

      ctx.restore()
    })

    ctx.restore()

    // Draw selection box
    if (selectionBox) {
      drawSelectionBox()
    }

    // Draw resize handles for selected elements
    if (selectedElements.length > 0 && (tool === "move" || tool === "select")) {
      drawResizeHandles(selectedElements)
    }
  }, [
    ctx,
    elements,
    selectedElements,
    showGrid,
    zoom,
    panOffset,
    selectionBox,
    tool,
    drawGrid,
    drawSelectionBox,
    drawResizeHandles,
  ])

  const isPointInElement = (x: number, y: number, element: DrawingElement) => {
    if (element.type === "text") {
      return x >= element.x && x <= element.x + 50 && y >= element.y - element.fontSize && y <= element.y
    } else if (element.type === "circle") {
      const centerX = element.startX
      const centerY = element.startY
      const radius = Math.sqrt(Math.pow(element.endX - element.startX, 2) + Math.pow(element.endY - element.startY, 2))
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2))
      return distance <= radius + 5 / zoom
    } else if (element.type === "pen" && element.points) {
      return element.points.some((point) => {
        const distance = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2))
        return distance < 10 / zoom
      })
    } else {
      const minX = Math.min(element.startX, element.endX)
      const maxX = Math.max(element.startX, element.endX)
      const minY = Math.min(element.startY, element.endY)
      const maxY = Math.max(element.startY, element.endY)

      const padding = 5 / zoom
      return x >= minX - padding && x <= maxX + padding && y >= minY - padding && y <= maxY + padding
    }
  }

  const eraseElements = (x: number, y: number) => {
    // Find elements at the click position, in reverse order (topmost first)
    const elementsAtPoint = [...elements].reverse().filter((el) => isPointInElement(x, y, el))

    if (elementsAtPoint.length > 0) {
      // Only erase the topmost element
      const elementToErase = elementsAtPoint[0]
      setElements((prev) => prev.filter((el) => el.id !== elementToErase.id))
      setSelectedElements((prev) => prev.filter((el) => el.id !== elementToErase.id))
      saveToHistory()
    }
  }

  const clearCanvas = () => {
    setElements([])
    setSelectedElements([])
    saveToHistory()
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
    if (newTool !== "select" && newTool !== "move") {
      setSelectedElements([])
    }
  }

  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!canvasRef.current) return

    const { x, y } = transformCoordinates(e.clientX, e.clientY)

    const clickedElement = elements.find((el) => el.type === "text" && isPointInElement(x, y, el))
    if (clickedElement && clickedElement.type === "text") {
      setEditingTextId(clickedElement.id)
      setTextInput(clickedElement.content)
      setTextPosition({ x: clickedElement.x, y: clickedElement.y })
      setIsAddingText(true)
      setTimeout(() => textInputRef.current?.focus(), 0)
    } else if (copiedElements.length > 0) {
      pasteElements(x, y)
    }
  }

  const copyElements = () => {
    if (selectedElements.length > 0) {
      setCopiedElements([...selectedElements])
    }
  }

  const pasteElements = (x?: number, y?: number) => {
    if (copiedElements.length === 0) return

    const pasteX = x ?? 50
    const pasteY = y ?? 50

    const newElements = copiedElements.map((element, index) => {
      let newElement = { ...element, id: Date.now().toString() + Math.random() + index }

      if (newElement.type === "text") {
        newElement.x = pasteX + index * 10
        newElement.y = pasteY + index * 10
      } else {
        const width = newElement.endX - newElement.startX
        const height = newElement.endY - newElement.startY
        newElement.startX = pasteX + index * 10
        newElement.startY = pasteY + index * 10
        newElement.endX = pasteX + width + index * 10
        newElement.endY = pasteY + height + index * 10

        if (newElement.points) {
          const offsetX = pasteX + index * 10 - element.startX
          const offsetY = pasteY + index * 10 - element.startY
          newElement.points = element.points.map((point) => ({
            x: point.x + offsetX,
            y: point.y + offsetY,
          }))
        }
      }

      // Apply grid snapping to pasted elements
      if (gridSnap) {
        newElement = snapElementToGrid(newElement)
      }

      return newElement
    })

    setElements((prev) => [...prev, ...newElements])
    setSelectedElements(newElements)
    saveToHistory()
  }

  const duplicateElements = () => {
    if (selectedElements.length === 0) return

    const duplicated = selectedElements.map((element) => {
      const newElement = { ...element, id: Date.now().toString() + Math.random() }

      if (newElement.type === "text") {
        newElement.x += 20
        newElement.y += 20
      } else {
        newElement.startX += 20
        newElement.startY += 20
        newElement.endX += 20
        newElement.endY += 20

        if (newElement.points) {
          newElement.points = newElement.points.map((point) => ({
            x: point.x + 20,
            y: point.y + 20,
          }))
        }
      }

      return newElement
    })

    setElements((prev) => [...prev, ...duplicated])
    setSelectedElements(duplicated)
    saveToHistory()
  }

  const deleteSelectedElements = () => {
    if (selectedElements.length === 0) return

    setElements((prev) => prev.filter((el) => !selectedElements.some((sel) => sel.id === el.id)))
    setSelectedElements([])
    saveToHistory()
  }

  const selectAll = () => {
    setSelectedElements([...elements])
  }

  const rotateSelectedElements = () => {
    if (selectedElements.length === 0) return

    setElements((prev) =>
      prev.map((el) => {
        if (selectedElements.some((sel) => sel.id === el.id)) {
          return { ...el, rotation: (el.rotation || 0) + 90 }
        }
        return el
      }),
    )

    setSelectedElements((prev) => prev.map((el) => ({ ...el, rotation: (el.rotation || 0) + 90 })))
    saveToHistory()
  }

  const flipSelectedElementsHorizontal = () => {
    if (selectedElements.length === 0) return

    setElements((prev) =>
      prev.map((el) => {
        if (selectedElements.some((sel) => sel.id === el.id)) {
          return { ...el, flipX: !el.flipX }
        }
        return el
      }),
    )

    setSelectedElements((prev) => prev.map((el) => ({ ...el, flipX: !el.flipX })))
    saveToHistory()
  }

  const flipSelectedElementsVertical = () => {
    if (selectedElements.length === 0) return

    setElements((prev) =>
      prev.map((el) => {
        if (selectedElements.some((sel) => sel.id === el.id)) {
          return { ...el, flipY: !el.flipY }
        }
        return el
      }),
    )

    setSelectedElements((prev) => prev.map((el) => ({ ...el, flipY: !el.flipY })))
    saveToHistory()
  }

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        handleZoom(delta, e.clientX, e.clientY)
      } else {
        // Pan with mouse wheel when not holding Ctrl
        e.preventDefault()
        const panSpeed = 1
        setPanOffset((prev) => ({
          x: prev.x - e.deltaX * panSpeed,
          y: prev.y - e.deltaY * panSpeed,
        }))
      }
    },
    [handleZoom],
  )

  const getCursorStyle = useCallback(() => {
    if (tool === "select" || tool === "move") {
      if (selectedElements.length > 0 && resizeHandle) {
        switch (resizeHandle) {
          case "nw":
          case "se":
            return "cursor-nw-resize"
          case "ne":
          case "sw":
            return "cursor-ne-resize"
          case "n":
          case "s":
            return "cursor-ns-resize"
          case "e":
          case "w":
            return "cursor-ew-resize"
          default:
            return "cursor-move"
        }
      }
      return "cursor-default"
    }
    if (tool === "eraser") return "cursor-crosshair"
    if (tool === "text") return "cursor-text"
    return "cursor-crosshair"
  }, [tool, selectedElements, resizeHandle])

  return (
    <div className="relative h-full w-full">
      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-2 p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md">
        <div className="flex items-center gap-1 border-r pr-2">
          <Button
            variant={tool === "select" ? "default" : "outline"}
            size="icon"
            onClick={() => handleToolChange("select")}
            className="h-9 w-9"
            title="Select Tool (V)"
          >
            <Move className="h-5 w-5" />
          </Button>
          <Button
            variant={tool === "pen" ? "default" : "outline"}
            size="icon"
            onClick={() => handleToolChange("pen")}
            className="h-9 w-9"
            title="Pen Tool (P)"
          >
            <Pencil className="h-5 w-5" />
          </Button>
          <Button
            variant={tool === "line" ? "default" : "outline"}
            size="icon"
            onClick={() => handleToolChange("line")}
            className="h-9 w-9"
            title="Line Tool (L)"
          >
            <Minus className="h-5 w-5" />
          </Button>
          <Button
            variant={tool === "rectangle" ? "default" : "outline"}
            size="icon"
            onClick={() => handleToolChange("rectangle")}
            className="h-9 w-9"
            title="Rectangle Tool (R)"
          >
            <Square className="h-5 w-5" />
          </Button>
          <Button
            variant={tool === "circle" ? "default" : "outline"}
            size="icon"
            onClick={() => handleToolChange("circle")}
            className="h-9 w-9"
            title="Circle Tool (C)"
          >
            <Circle className="h-5 w-5" />
          </Button>
          <Button
            variant={tool === "text" ? "default" : "outline"}
            size="icon"
            onClick={() => handleToolChange("text")}
            className="h-9 w-9"
            title="Text Tool (T)"
          >
            <Type className="h-5 w-5" />
          </Button>
          <Button
            variant={tool === "eraser" ? "default" : "outline"}
            size="icon"
            onClick={() => handleToolChange("eraser")}
            className="h-9 w-9"
            title="Eraser Tool (E)"
          >
            <Eraser className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-1 border-r pr-2">
          <Button
            variant="outline"
            size="icon"
            onClick={copyElements}
            disabled={selectedElements.length === 0}
            className="h-9 w-9 bg-transparent"
            title="Copy (Ctrl+C)"
          >
            <Copy className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={rotateSelectedElements}
            disabled={selectedElements.length === 0}
            className="h-9 w-9 bg-transparent"
            title="Rotate 90°"
          >
            <RotateCw className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={flipSelectedElementsHorizontal}
            disabled={selectedElements.length === 0}
            className="h-9 w-9 bg-transparent"
            title="Flip Horizontal"
          >
            <FlipHorizontal className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={flipSelectedElementsVertical}
            disabled={selectedElements.length === 0}
            className="h-9 w-9 bg-transparent"
            title="Flip Vertical"
          >
            <FlipVertical className="h-5 w-5" />
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

        <div className="flex items-center gap-1 border-r pr-2">
          <Button
            variant="outline"
            size="icon"
            onClick={undo}
            disabled={historyIndex <= 0}
            className="h-9 w-9 bg-transparent"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="h-9 w-9 bg-transparent"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-1 border-r pr-2">
          <Button variant="outline" size="icon" onClick={() => handleZoom(-0.2)} className="h-9 w-9" title="Zoom Out">
            <ZoomOut className="h-5 w-5" />
          </Button>
          <span className="text-sm font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="icon" onClick={() => handleZoom(0.2)} className="h-9 w-9" title="Zoom In">
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setZoom(1)
              setPanOffset({ x: 0, y: 0 })
            }}
            className="h-9 w-9"
            title="Reset View (Fit to Screen)"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Toggle pressed={showGrid} onPressedChange={setShowGrid} aria-label="Toggle grid">
            <Grid className="h-4 w-4" />
          </Toggle>
          <Toggle pressed={gridSnap} onPressedChange={setGridSnap} aria-label="Snap to grid" className="text-xs">
            Snap
          </Toggle>

          <Button
            variant="outline"
            size="icon"
            onClick={clearCanvas}
            className="h-9 w-9 bg-transparent"
            title="Clear Canvas"
          >
            <Trash2 className="h-5 w-5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={downloadCanvas}
            className="h-9 w-9 bg-transparent"
            title="Download"
          >
            <Download className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md text-sm">
        <span>Selected: {selectedElements.length}</span>
        <span>|</span>
        <span>Elements: {elements.length}</span>
        <span>|</span>
        <span>Zoom: {Math.round(zoom * 100)}%</span>
        <span>|</span>
        <span>
          X: {Math.round(-panOffset.x / zoom)}, Y: {Math.round(-panOffset.y / zoom)}
        </span>
      </div>

      {/* Text input */}
      {isAddingText && (
        <div
          className="absolute z-20 flex"
          style={{ left: textPosition.x * zoom + panOffset.x, top: textPosition.y * zoom + panOffset.y }}
        >
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
        className={getCursorStyle()}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={finishDrawing}
        onMouseLeave={finishDrawing}
        onContextMenu={handleCanvasContextMenu}
        onWheel={handleWheel}
      />
    </div>
  )
}
