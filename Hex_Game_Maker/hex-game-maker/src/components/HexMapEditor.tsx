import React, { useRef, useEffect, useState, useCallback } from 'react'
import type { MapData, HexData, HexType } from '../types'
import { hexKey, offsetToAxial } from '../types'
import './HexMapEditor.css'

interface Props {
  mapData: MapData
  setMapData: React.Dispatch<React.SetStateAction<MapData>>
  selectedTool: HexType
  selectedZone: number
  showGrid: boolean
  symmetryMode: 'none' | 'horizontal' | 'vertical' | 'rotational'
}

const HexMapEditor: React.FC<Props> = ({
  mapData,
  setMapData,
  selectedTool,
  selectedZone,
  showGrid,
  symmetryMode
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredHex, setHoveredHex] = useState<{ q: number; r: number } | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [panOffset, setPanOffset] = useState({ x: 600, y: 400 })
  const [zoom, setZoom] = useState(1)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })

  // Fixed hexagon dimensions - NEVER squish
  const hexRadius = 30
  
  // Convert axial coordinates to screen position (same as main game)
  const hexToScreen = useCallback((q: number, r: number) => {
    const x = hexRadius * (3/2 * q)
    const y = hexRadius * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r)
    return { x, y }
  }, [hexRadius])

  // Convert screen position to axial coordinates
  const screenToHex = useCallback((screenX: number, screenY: number) => {
    // Adjust for pan and zoom
    const x = (screenX - panOffset.x) / zoom
    const y = (screenY - panOffset.y) / zoom

    // Convert to fractional axial coordinates
    const q = (2/3 * x) / hexRadius
    const r = (-1/3 * x + Math.sqrt(3)/3 * y) / hexRadius
    
    // Convert to cube coordinates for rounding
    const s = -q - r
    
    // Round to nearest hex
    let rq = Math.round(q)
    let rr = Math.round(r)
    let rs = Math.round(s)
    
    // Fix rounding to maintain constraint q + r + s = 0
    const qDiff = Math.abs(rq - q)
    const rDiff = Math.abs(rr - r)
    const sDiff = Math.abs(rs - s)
    
    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs
    } else if (rDiff > sDiff) {
      rr = -rq - rs
    }
    
    return { q: rq, r: rr }
  }, [panOffset, zoom, hexRadius])

  // Convert axial to col/row for display
  const axialToColRow = (q: number, r: number) => {
    // This is arbitrary - we can define any mapping we want
    // Let's use a simple offset where q=0,r=0 is at col 'z', row 26
    const colIndex = q + 25
    const row = r + 26
    
    if (colIndex >= 0 && colIndex < 52) {
      const col = String.fromCharCode('a'.charCodeAt(0) + colIndex)
      return { col, row }
    }
    return null
  }

  // Convert col/row to axial
  const colRowToAxial = (col: string, row: number) => {
    const colIndex = col.charCodeAt(0) - 'a'.charCodeAt(0)
    const q = colIndex - 25
    const r = row - 26
    return { q, r }
  }

  // Get hex color based on type
  const getHexColor = (type: HexType, zone?: number): string => {
    switch (type) {
      case 'normal': return '#1a1a2e'
      case 'deployment': 
        const colors = ['#001aff', '#ff0000', '#00ff00', '#ffff00', '#ff00ff', '#00ffff']
        return colors[(zone || 1) - 1] || colors[0]
      case 'obstacle': return '#000000'
      case 'debris': return '#4a4a4a'
      case 'door': return '#8b4513'
      case 'corridor': return '#2a2a3e'
      case 'room': return '#16213e'
      case 'objective': return '#ffd700'
      case 'overwatch': return '#ff6600'
      case 'spawn': return '#9932cc'
      case 'exit': return '#00ff00'
      default: return '#1a1a2e'
    }
  }

  // Draw a flat-top hexagon (same as main game)
  const drawHex = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    fillColor: string,
    strokeColor: string = '#444',
    lineWidth: number = 1
  ) => {
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.closePath()
    
    ctx.fillStyle = fillColor
    ctx.fill()
    
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }

  // Draw the map
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Save context state
    ctx.save()
    
    // Apply zoom and pan
    ctx.translate(panOffset.x, panOffset.y)
    ctx.scale(zoom, zoom)
    
    // Create a map of existing hexes for quick lookup
    const hexMap = new Map<string, HexData>()
    mapData.hexes.forEach(hex => {
      hexMap.set(`${hex.q},${hex.r}`, hex)
    })
    
    // Calculate visible range in axial coordinates
    const visibleBounds = {
      minX: -panOffset.x / zoom - 100,
      maxX: (canvas.width - panOffset.x) / zoom + 100,
      minY: -panOffset.y / zoom - 100,
      maxY: (canvas.height - panOffset.y) / zoom + 100
    }
    
    // Convert to approximate q,r range
    const minQ = Math.floor((2/3 * visibleBounds.minX) / hexRadius) - 2
    const maxQ = Math.ceil((2/3 * visibleBounds.maxX) / hexRadius) + 2
    const minR = Math.floor((visibleBounds.minY / Math.sqrt(3) - visibleBounds.maxX / 3) / hexRadius) - 2
    const maxR = Math.ceil((visibleBounds.maxY / Math.sqrt(3) - visibleBounds.minX / 3) / hexRadius) + 2
    
    // Draw grid if enabled
    if (showGrid) {
      for (let q = minQ; q <= maxQ; q++) {
        for (let r = minR; r <= maxR; r++) {
          const { x, y } = hexToScreen(q, r)
          const isHovered = hoveredHex?.q === q && hoveredHex?.r === r
          const hex = hexMap.get(`${q},${r}`)
          
          if (hex) {
            // Draw existing hex
            const color = getHexColor(hex.type, hex.zone)
            drawHex(ctx, x, y, hexRadius, color, isHovered ? '#00ff88' : '#666', isHovered ? 3 : 1)
            
            // Draw labels
            if (hex.type !== 'normal' && hex.type !== 'corridor') {
              ctx.fillStyle = '#fff'
              ctx.font = 'bold 10px Arial'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              
              if (hex.type === 'deployment' && hex.zone) {
                ctx.fillText(`D${hex.zone}`, x, y)
              } else if (hex.type === 'objective') {
                ctx.fillText('OBJ', x, y)
              } else if (hex.type === 'spawn') {
                ctx.fillText('SP', x, y)
              } else if (hex.type === 'door') {
                ctx.fillText('DR', x, y)
              } else if (hex.type === 'exit') {
                ctx.fillText('EX', x, y)
              }
            }
          } else {
            // Draw empty grid hex
            drawHex(
              ctx, 
              x, 
              y, 
              hexRadius, 
              'transparent', 
              isHovered ? '#00ff88' : '#333', 
              isHovered ? 2 : 0.5
            )
          }
          
          // Draw coordinates for reference
          if (zoom > 0.7) {
            const colRow = axialToColRow(q, r)
            if (colRow) {
              ctx.fillStyle = '#555'
              ctx.font = '8px Arial'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              ctx.fillText(`${colRow.col}${colRow.row}`, x, y + hexRadius + 3)
            }
          }
        }
      }
    } else {
      // Only draw placed hexes
      mapData.hexes.forEach(hex => {
        const { x, y } = hexToScreen(hex.q, hex.r)
        const isHovered = hoveredHex?.q === hex.q && hoveredHex?.r === hex.r
        const color = getHexColor(hex.type, hex.zone)
        drawHex(ctx, x, y, hexRadius, color, isHovered ? '#00ff88' : '#666', isHovered ? 3 : 1)
      })
    }
    
    // Draw overwatch lanes
    const overwatchHexes = mapData.hexes.filter(h => h.type === 'overwatch')
    overwatchHexes.forEach(hex => {
      const { x, y } = hexToScreen(hex.q, hex.r)
      ctx.strokeStyle = '#ff6600'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.arc(x, y, hexRadius + 5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    })
    
    // Restore context state
    ctx.restore()
    
    // Draw UI info
    ctx.fillStyle = '#fff'
    ctx.font = '12px Arial'
    ctx.fillText(`Hexes: ${mapData.hexes.length}`, 10, canvas.height - 10)
    if (hoveredHex) {
      const colRow = axialToColRow(hoveredHex.q, hoveredHex.r)
      if (colRow) {
        ctx.fillText(`Hex: ${colRow.col}${colRow.row}`, 10, canvas.height - 25)
      }
    }
  }, [mapData, hoveredHex, showGrid, panOffset, zoom, hexToScreen, hexRadius, getHexColor])

  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    if (isPanning) {
      const dx = e.clientX - lastPanPoint.x
      const dy = e.clientY - lastPanPoint.y
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
      setLastPanPoint({ x: e.clientX, y: e.clientY })
      return
    }
    
    const rect = canvas.getBoundingClientRect()
    // Scale mouse coordinates to match canvas internal resolution
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const canvasX = (e.clientX - rect.left) * scaleX
    const canvasY = (e.clientY - rect.top) * scaleY
    
    const hex = screenToHex(canvasX, canvasY)
    setHoveredHex(hex)
    
    // Continue drawing if mouse is down
    if (isDrawing && hex) {
      placeHex(hex.q, hex.r)
    }
  }

  // Get symmetrical hexes
  const getSymmetricalHexes = (q: number, r: number): Array<{ q: number; r: number }> => {
    const hexes = [{ q, r }]
    
    if (symmetryMode === 'none') return hexes
    
    if (symmetryMode === 'horizontal') {
      hexes.push({ q: -q - r, r })
    } else if (symmetryMode === 'vertical') {
      hexes.push({ q, r: -q - r })
    } else if (symmetryMode === 'rotational') {
      hexes.push({ q: -q, r: -r })
    }
    
    return hexes
  }

  // Place or remove hex
  const placeHex = (q: number, r: number) => {
    const hexesToModify = getSymmetricalHexes(q, r)
    
    setMapData(prev => {
      const newHexes = [...prev.hexes]
      const zones = { ...prev.deploymentZones }
      
      hexesToModify.forEach(hexPos => {
        const key = `${hexPos.q},${hexPos.r}`
        const existingIndex = newHexes.findIndex(h => h.q === hexPos.q && h.r === hexPos.r)
        
        if (existingIndex !== -1) {
          // Replace or remove
          const existingHex = newHexes[existingIndex]
          
          if (existingHex.type === selectedTool && 
              (selectedTool !== 'deployment' || existingHex.zone === selectedZone)) {
            // Remove hex
            newHexes.splice(existingIndex, 1)
          } else {
            // Replace with new type
            const colRow = axialToColRow(hexPos.q, hexPos.r)
            if (colRow) {
              newHexes[existingIndex] = {
                col: colRow.col,
                row: colRow.row,
                q: hexPos.q,
                r: hexPos.r,
                type: selectedTool,
                zone: selectedTool === 'deployment' ? selectedZone : undefined
              }
            }
          }
        } else if (selectedTool !== 'normal') {
          // Add new hex
          const colRow = axialToColRow(hexPos.q, hexPos.r)
          if (colRow) {
            newHexes.push({
              col: colRow.col,
              row: colRow.row,
              q: hexPos.q,
              r: hexPos.r,
              type: selectedTool,
              zone: selectedTool === 'deployment' ? selectedZone : undefined
            })
          }
        }
      })
      
      return {
        ...prev,
        hexes: newHexes,
        deploymentZones: zones
      }
    })
  }

  // Handle click
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    // Scale mouse coordinates to match canvas internal resolution
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const canvasX = (e.clientX - rect.left) * scaleX
    const canvasY = (e.clientY - rect.top) * scaleY
    
    const hex = screenToHex(canvasX, canvasY)
    if (hex) {
      placeHex(hex.q, hex.r)
    }
  }

  // Handle mouse down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    if (e.button === 2 || e.shiftKey) {
      setIsPanning(true)
      setLastPanPoint({ x: e.clientX, y: e.clientY })
      e.preventDefault()
    } else if (e.button === 0) {
      setIsDrawing(true)
      
      const rect = canvas.getBoundingClientRect()
      // Scale mouse coordinates to match canvas internal resolution
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const canvasX = (e.clientX - rect.left) * scaleX
      const canvasY = (e.clientY - rect.top) * scaleY
      
      const hex = screenToHex(canvasX, canvasY)
      if (hex) {
        placeHex(hex.q, hex.r)
      }
    }
  }

  // Handle mouse up
  const handleMouseUp = () => {
    setIsPanning(false)
    setIsDrawing(false)
  }

  // Handle wheel for zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.max(0.3, Math.min(5, prev * delta)))
  }

  // Reset view
  const resetView = () => {
    setPanOffset({ x: 600, y: 400 })
    setZoom(1)
  }

  // Redraw when state changes
  useEffect(() => {
    draw()
  }, [draw])

  return (
    <div className="hex-map-editor">
      <canvas
        ref={canvasRef}
        width={1200}
        height={800}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={e => e.preventDefault()}
      />
      <div className="editor-info">
        <div>Total: {mapData.hexes.length}</div>
        <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
        <button onClick={resetView}>Reset View</button>
        <div className="controls-hint">
          Left Click/Drag: Draw | Right Click/Shift: Pan | Scroll: Zoom
        </div>
      </div>
    </div>
  )
}

export default HexMapEditor