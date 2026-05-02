// @ts-nocheck
import React from 'react'

export const OverlayFragment = ({ pane, currentOverlayRef, currentApiRef, currentSeriesRef, clipWLocal, clipHLocal, localClipId, activeTool, getCursorStyle, handleOverlayClick, handleOverlayMove, handleOverlayMouseDown, isDrawingToolActive, clearToolDrafts, showOverlays, overlayBrushes, setOverlayBrushes, pointsToSmoothPath, pushUndoSnapshot, isBrushingRef, liveBrushPointsRef, brushTick, overlayLines, setOverlayLines, setSelectedOverlayId, dragStateRef, getOverlayPoint, extendLine, selectedOverlayId, overlayRects, setOverlayRects, overlayFibs, setOverlayFibs, overlayLabels, setOverlayLabels, draftStart, hoverPoint, measureStart, measureEnd, activePane, setActivePane, interval, timeframeToSeconds }) => {
  const PRICE_SCALE_WIDTH = 65
  const TIME_SCALE_HEIGHT = 26
  
  return (
    <svg
      ref={currentOverlayRef}
      className={`absolute inset-0 h-full w-full pointer-events-${(activeTool === 'zoom' && isDrawingToolActive) ? 'auto' : 'none'}`}
      style={{ zIndex: 20, cursor: activeTool === 'zoom' ? getCursorStyle() : undefined }}
      onClick={(e) => handleOverlayClick(e, pane)}
      onMouseMove={(e) => handleOverlayMove(e, pane)}
      onMouseDown={(e) => handleOverlayMouseDown(e, pane)}
      onMouseEnter={() => setActivePane(pane)}
      onContextMenu={(e) => { e.preventDefault(); if (isDrawingToolActive) clearToolDrafts() }}
    >
      <defs>
        <clipPath id={localClipId}>
          <rect x="0" y="0" width={clipWLocal || 800} height={clipHLocal || 500} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${localClipId})`} style={{ cursor: activeTool !== 'zoom' ? getCursorStyle() : undefined, pointerEvents: (activeTool !== 'zoom' && isDrawingToolActive) ? 'all' : 'none' }}>
        <rect x="0" y="0" width={clipWLocal || 800} height={clipHLocal || 500} fill="transparent" />
        {showOverlays && overlayBrushes.filter(b => (b.targetPane || 'primary') === pane).map((brush) => {
          const currentPoints = brush.points.map(p => ({
            x: p.logical !== undefined ? (currentApiRef.current?.timeScale().logicalToCoordinate(p.logical as any) ?? p.x) : p.x,
            y: p.price !== undefined ? (currentSeriesRef.current?.priceToCoordinate(p.price) ?? p.y) : p.y,
          }))
          const d = pointsToSmoothPath(currentPoints)
          return (
            <path key={brush.id} d={d} fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeTool === 'eraser' ? 'cursor-pointer' : ''} style={{ pointerEvents: 'stroke' }} onClick={(e) => { if (activeTool === 'eraser') { e.stopPropagation(); pushUndoSnapshot(); setOverlayBrushes(prev => prev.filter(b => b.id !== brush.id)) } }} onMouseDown={(e) => { if (activeTool === 'eraser') { e.stopPropagation(); pushUndoSnapshot(); setOverlayBrushes(prev => prev.filter(b => b.id !== brush.id)) } }} onMouseEnter={(e) => { if (activeTool === 'eraser' && e.buttons === 1) { e.stopPropagation(); pushUndoSnapshot(); setOverlayBrushes(prev => prev.filter(b => b.id !== brush.id)) } }} />
          )
        })}

        {showOverlays && isBrushingRef.current && liveBrushPointsRef.current.length > 1 && brushTick >= 0 && activePane === pane && (
          <path d={pointsToSmoothPath(liveBrushPointsRef.current)} fill="none" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }} />
        )}

        {showOverlays && overlayLines.filter(l => (l.targetPane || 'primary') === pane).map((ln) => {
          const svgW = clipWLocal || (currentOverlayRef.current?.clientWidth ?? 800) - PRICE_SCALE_WIDTH
          const svgH = clipHLocal || (currentOverlayRef.current?.clientHeight ?? 500) - TIME_SCALE_HEIGHT

          // Re-resolve pixel coords from stored logical/price so lines track on zoom/scroll
          const x1 = ln.logical1 !== undefined ? (currentApiRef.current?.timeScale().logicalToCoordinate(ln.logical1 as any) ?? ln.x1) : ln.x1
          const y1 = ln.price1 !== undefined ? (currentSeriesRef.current?.priceToCoordinate(ln.price1) ?? ln.y1) : ln.y1
          const x2 = ln.logical2 !== undefined ? (currentApiRef.current?.timeScale().logicalToCoordinate(ln.logical2 as any) ?? ln.x2) : ln.x2
          const y2 = ln.price2 !== undefined ? (currentSeriesRef.current?.priceToCoordinate(ln.price2) ?? ln.y2) : ln.y2

          const onLineClick = (e: ReactMouseEvent) => {
            if (activeTool === 'eraser') { e.stopPropagation(); pushUndoSnapshot(); setOverlayLines(prev => prev.filter(p => p.id !== ln.id)); return }
            e.stopPropagation(); setSelectedOverlayId(ln.id); return
          }
          const onLineMouseDown = (e: ReactMouseEvent, type: 'p1' | 'p2' | 'body') => {
            if (activeTool === 'eraser') { e.stopPropagation(); pushUndoSnapshot(); setOverlayLines(prev => prev.filter(p => p.id !== ln.id)); return }
            if (activeTool === 'zoom') return;
            e.stopPropagation(); setSelectedOverlayId(ln.id);
            dragStateRef.current = { id: ln.id, collection: 'lines', type, startX: getOverlayPoint(e, pane)?.x || 0, startY: getOverlayPoint(e, pane)?.y || 0, startLogical: getOverlayPoint(e, pane)?.logical, startPrice: getOverlayPoint(e, pane)?.price, origItem: ln };
          }
          const onLineMouseEnter = (e: ReactMouseEvent) => {
            if (activeTool === 'eraser' && e.buttons === 1) { e.stopPropagation(); pushUndoSnapshot(); setOverlayLines(prev => prev.filter(p => p.id !== ln.id)); }
          }

          if (ln.kind === 'arrow') {
            const color = y2 < y1 ? '#00C076' : '#FF3B30'
            const angle = Math.atan2(y2 - y1, x2 - x1)
            const arrowSize = 10
            const offset = 2
            const endX = x2 - Math.cos(angle) * offset
            const endY = y2 - Math.sin(angle) * offset
            const pt1X = endX - arrowSize * Math.cos(angle - Math.PI / 6)
            const pt1Y = endY - arrowSize * Math.sin(angle - Math.PI / 6)
            const pt2X = endX - arrowSize * Math.cos(angle + Math.PI / 6)
            const pt2Y = endY - arrowSize * Math.sin(angle + Math.PI / 6)
            return (
              <g onClick={onLineClick} onMouseEnter={onLineMouseEnter} key={ln.id} style={{ pointerEvents: 'all' }} className={activeTool === 'eraser' ? 'cursor-pointer' : 'cursor-move'} onMouseDown={(e) => onLineMouseDown(e, 'body')}>
                <line x1={x1} y1={y1} x2={Math.abs(endX - x1) < 1 ? x1 : endX} y2={Math.abs(endY - y1) < 1 ? y1 : endY} stroke="transparent" strokeWidth="20" strokeLinecap="round" />
                <line x1={x1} y1={y1} x2={Math.abs(endX - x1) < 1 ? x1 : endX} y2={Math.abs(endY - y1) < 1 ? y1 : endY} stroke={color} strokeWidth="2" strokeLinecap="round" pointerEvents="none" />
                <polygon points={`${endX},${endY} ${pt1X},${pt1Y} ${pt2X},${pt2Y}`} fill={color} pointerEvents="none" />
                {ln.id === selectedOverlayId && (
                  <>
                    <circle cx={x1} cy={y1} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'p1') }} />
                    <circle cx={x2} cy={y2} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'p2') }} />
                  </>
                )}
              </g>
            )
          }

          if (ln.kind === 'ray') {
            const [, , ex, ey] = extendLine(x1, y1, x2, y2, svgW, svgH, false)
            return (
              <g key={ln.id} onClick={onLineClick} onMouseEnter={onLineMouseEnter} style={{ pointerEvents: 'all' }} className={activeTool === 'eraser' ? 'cursor-pointer' : 'cursor-move'} onMouseDown={(e) => onLineMouseDown(e, 'body')}>
                <line x1={x1} y1={y1} x2={ex} y2={ey} stroke="transparent" strokeWidth="20" />
                <line x1={x1} y1={y1} x2={ex} y2={ey} stroke="#60A5FA" strokeWidth="1.5" strokeDasharray="6 3" pointerEvents="none" />
                {ln.id === selectedOverlayId && (
                  <>
                    <circle cx={x1} cy={y1} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'p1') }} />
                    <circle cx={x2} cy={y2} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'p2') }} />
                  </>
                )}
              </g>
            )
          }

          if (ln.kind === 'xline') {
            const [sx, sy, ex, ey] = extendLine(x1, y1, x2, y2, svgW, svgH, true)
            return (
              <g key={ln.id} onClick={onLineClick} onMouseEnter={onLineMouseEnter} style={{ pointerEvents: 'all' }} className={activeTool === 'eraser' ? 'cursor-pointer' : 'cursor-move'} onMouseDown={(e) => onLineMouseDown(e, 'body')}>
                <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="transparent" strokeWidth="20" />
                <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#60A5FA" strokeWidth="1.5" strokeDasharray="8 4" pointerEvents="none" />
                {ln.id === selectedOverlayId && (
                  <>
                    <circle cx={x1} cy={y1} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'p1') }} />
                    <circle cx={x2} cy={y2} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'p2') }} />
                  </>
                )}
              </g>
            )
          }

          // FIX B3/B7: hline — y re-resolved from price1 above; render within clipWLocal only
          if (ln.kind === 'hline') {
            return (
              <g key={ln.id} onClick={onLineClick} onMouseEnter={onLineMouseEnter} style={{ pointerEvents: 'all' }} className={activeTool === 'eraser' ? 'cursor-pointer' : 'cursor-move'} onMouseDown={(e) => onLineMouseDown(e, 'body')}>
                <line x1={0} y1={y1} x2={svgW} y2={y1} stroke="transparent" strokeWidth="20" />
                {/* FIX B4: use clipWLocal (not svgW) for visible line to stay in chart area */}
                <line x1={0} y1={y1} x2={clipWLocal || svgW} y2={y1} stroke="#60A5FA" strokeWidth="1.5" strokeDasharray="4 2" pointerEvents="none" />
                {ln.id === selectedOverlayId && (
                  <circle cx={(clipWLocal || svgW) / 2} cy={y1} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'body') }} />
                )}
              </g>
            )
          }

          // FIX B7: hray — y re-resolved from price1 above; x1 from logical1
          if (ln.kind === 'hray') {
            return (
              <g key={ln.id} onClick={onLineClick} onMouseEnter={onLineMouseEnter} style={{ pointerEvents: 'all' }} className={activeTool === 'eraser' ? 'cursor-pointer' : 'cursor-move'} onMouseDown={(e) => onLineMouseDown(e, 'body')}>
                <line x1={x1} y1={y1} x2={svgW} y2={y1} stroke="transparent" strokeWidth="20" />
                <line x1={x1} y1={y1} x2={clipWLocal || svgW} y2={y1} stroke="#60A5FA" strokeWidth="1.5" pointerEvents="none" />
                {ln.id === selectedOverlayId && (
                  <circle cx={x1} cy={y1} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'body') }} />
                )}
              </g>
            )
          }

          // FIX B5/B6: crossline — both x and y re-resolved from logical1/price1 above
          if (ln.kind === 'crossline') {
            return (
              <g key={ln.id} onClick={onLineClick} onMouseEnter={onLineMouseEnter} style={{ pointerEvents: 'all' }} className={activeTool === 'eraser' ? 'cursor-pointer' : 'cursor-move'} onMouseDown={(e) => onLineMouseDown(e, 'body')}>
                <line x1={0} y1={y1} x2={svgW} y2={y1} stroke="transparent" strokeWidth="20" />
                <line x1={0} y1={y1} x2={clipWLocal || svgW} y2={y1} stroke="#60A5FA" strokeWidth="1.5" strokeDasharray="4 2" pointerEvents="none" />
                <line x1={x1} y1={0} x2={x1} y2={svgH} stroke="transparent" strokeWidth="20" />
                <line x1={x1} y1={0} x2={x1} y2={svgH} stroke="#60A5FA" strokeWidth="1.5" strokeDasharray="4 2" pointerEvents="none" />
                {ln.id === selectedOverlayId && (
                  <circle cx={x1} cy={y1} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'body') }} />
                )}
              </g>
            )
          }

          // FIX B5: vline — dedicated render block, uses svgH = clipHLocal (no time-scale bleed)
          if (ln.kind === 'vline') {
            return (
              <g key={ln.id} onClick={onLineClick} onMouseEnter={onLineMouseEnter} style={{ pointerEvents: 'all' }} className={activeTool === 'eraser' ? 'cursor-pointer' : 'cursor-move'} onMouseDown={(e) => onLineMouseDown(e, 'body')}>
                <line x1={x1} y1={0} x2={x1} y2={svgH} stroke="transparent" strokeWidth="20" />
                <line x1={x1} y1={0} x2={x1} y2={svgH} stroke="#60A5FA" strokeWidth="1.5" strokeDasharray="4 2" pointerEvents="none" />
                {ln.id === selectedOverlayId && (
                  <circle cx={x1} cy={svgH / 2} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'body') }} />
                )}
              </g>
            )
          }

          if (ln.kind === 'angle') {
            const angle = Math.atan2(y2 - y1, x2 - x1)
            const deg = -angle * (180 / Math.PI)
            const r = 24
            const arcX = x1 + r * Math.cos(angle)
            const arcY = y1 + r * Math.sin(angle)
            // FIX B11: clamp label so it doesn't overflow clipWLocal
            const labelX = Math.min(x2 + 8, (clipWLocal || svgW) - 52)
            return (
              <g key={ln.id} onClick={onLineClick} onMouseEnter={onLineMouseEnter} style={{ pointerEvents: 'all' }} className={activeTool === 'eraser' ? 'cursor-pointer' : 'cursor-move'} onMouseDown={(e) => onLineMouseDown(e, 'body')}>
                <line x1={x1} y1={y1} x2={x1 + Math.abs(x2 - x1) + 20} y2={y1} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" pointerEvents="none" />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="20" />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#60A5FA" strokeWidth="1.5" pointerEvents="none" />
                <path d={`M ${x1 + r} ${y1} A ${r} ${r} 0 0 ${angle > 0 ? 1 : 0} ${arcX} ${arcY}`} fill="rgba(96,165,250,0.15)" stroke="#60A5FA" strokeWidth="1" pointerEvents="none" />
                <rect x={labelX} y={y2 - 10} width="40" height="20" rx="3" fill="#0B0E11" fillOpacity="0.9" stroke="#60A5FA" strokeWidth="1" pointerEvents="none" />
                <text x={labelX + 20} y={y2} fill="#60A5FA" fontSize="10" fontFamily="monospace" textAnchor="middle" alignmentBaseline="middle" pointerEvents="none">{deg > 0 ? '+' : ''}{deg.toFixed(1)}°</text>
                {ln.id === selectedOverlayId && (
                  <>
                    <circle cx={x1} cy={y1} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'p1') }} />
                    <circle cx={x2} cy={y2} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'p2') }} />
                  </>
                )}
              </g>
            )
          }

          if (ln.kind === 'infoline') {
            const mx = (x1 + x2) / 2
            const my = (y1 + y2) / 2
            const angle = Math.atan2(y2 - y1, x2 - x1)
            const deg = -angle * (180 / Math.PI)
            const priceDiff = (ln.price2 ?? 0) - (ln.price1 ?? 0)
            const pricePct = ln.price1 ? (priceDiff / ln.price1) * 100 : 0
            const barDiff = Math.abs((ln.logical2 ?? 0) - (ln.logical1 ?? 0))
            const isUp = priceDiff >= 0
            const lineColor = isUp ? '#00C076' : '#FF3B30'
            const bgColor = isUp ? 'rgba(0,192,118,0.12)' : 'rgba(255,59,48,0.12)'
            const borderColor = isUp ? 'rgba(0,192,118,0.5)' : 'rgba(255,59,48,0.5)'

            // Badge width adapts to content
            const priceStr = `${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} (${pricePct >= 0 ? '+' : ''}${pricePct.toFixed(2)}%)`
            const angleStr = `${deg.toFixed(1)}°`
            const barsStr = `${barDiff}b`
            const badgeW = 160
            const badgeH = 44
            const bx = mx - badgeW / 2
            const by = my - badgeH - 8

            // Perp offset for badge — show above or below depending on room
            const badgeY = by < 12 ? my + 8 : by

            return (
              <g key={ln.id} onClick={onLineClick} onMouseEnter={onLineMouseEnter} style={{ pointerEvents: 'all' }} className={activeTool === 'eraser' ? 'cursor-pointer' : 'cursor-move'} onMouseDown={(e) => onLineMouseDown(e, 'body')}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="20" />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={lineColor} strokeWidth="1.5" pointerEvents="none" />
                <circle cx={x1} cy={y1} r={3} fill={lineColor} opacity={0.7} pointerEvents="none" />
                <circle cx={x2} cy={y2} r={3} fill={lineColor} opacity={0.7} pointerEvents="none" />
                <line x1={mx} y1={my} x2={mx} y2={badgeY + badgeH / 2} stroke={borderColor} strokeWidth="1" strokeDasharray="3 2" pointerEvents="none" />
                <rect x={bx} y={badgeY} width={badgeW} height={badgeH} rx="5" fill={bgColor} stroke={borderColor} strokeWidth="1" pointerEvents="none" />
                <text x={bx + 8} y={badgeY + 15} fill={lineColor} fontSize="11" fontFamily="ui-monospace,monospace" fontWeight="600" pointerEvents="none">{priceStr}</text>
                <line x1={bx + 6} y1={badgeY + 22} x2={bx + badgeW - 6} y2={badgeY + 22} stroke={borderColor} strokeWidth="0.75" pointerEvents="none" />
                <text x={bx + 8} y={badgeY + 35} fill="#AAB0B6" fontSize="9.5" fontFamily="ui-monospace,monospace" pointerEvents="none">{barsStr}  ·  {angleStr}</text>
                {ln.id === selectedOverlayId && (
                  <>
                    <circle cx={x1} cy={y1} r={5} fill="#0B0E11" stroke={lineColor} strokeWidth={1.5} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'p1') }} />
                    <circle cx={x2} cy={y2} r={5} fill="#0B0E11" stroke={lineColor} strokeWidth={1.5} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'p2') }} />
                  </>
                )}
              </g>
            )
          }

          // Default: plain trend line
          return (
            <g key={ln.id} onClick={onLineClick} onMouseEnter={onLineMouseEnter} style={{ pointerEvents: 'all' }} className={activeTool === 'eraser' ? 'cursor-pointer' : 'cursor-move'} onMouseDown={(e) => onLineMouseDown(e, 'body')}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="20" />
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#60A5FA" strokeWidth="1.5" pointerEvents="none" />
              {ln.id === selectedOverlayId && (
                <>
                  <circle cx={x1} cy={y1} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'p1') }} />
                  <circle cx={x2} cy={y2} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onLineMouseDown(e, 'p2') }} />
                </>
              )}
            </g>
          )
        })}

        {showOverlays && overlayRects.filter(r => (r.targetPane || 'primary') === pane).map((r) => {
          const x1 = r.logical1 !== undefined ? (currentApiRef.current?.timeScale().logicalToCoordinate(r.logical1 as any) ?? r.x1) : r.x1
          const y1 = r.price1 !== undefined ? (currentSeriesRef.current?.priceToCoordinate(r.price1) ?? r.y1) : r.y1
          const x2 = r.logical2 !== undefined ? (currentApiRef.current?.timeScale().logicalToCoordinate(r.logical2 as any) ?? r.x2) : r.x2
          const y2 = r.price2 !== undefined ? (currentSeriesRef.current?.priceToCoordinate(r.price2) ?? r.y2) : r.y2
          const onClick = (e: ReactMouseEvent) => {
            if (activeTool === 'eraser') { e.stopPropagation(); pushUndoSnapshot(); setOverlayRects(prev => prev.filter(p => p.id !== r.id)); return }
            e.stopPropagation(); setSelectedOverlayId(r.id); return
          }
          const onMouseDown = (e: ReactMouseEvent, type: 'p1' | 'p2' | 'body') => {
            if (activeTool === 'eraser') { e.stopPropagation(); pushUndoSnapshot(); setOverlayRects(prev => prev.filter(p => p.id !== r.id)); return }
            if (activeTool === 'zoom') return;
            e.stopPropagation(); setSelectedOverlayId(r.id);
            dragStateRef.current = { id: r.id, collection: 'rects', type, startX: getOverlayPoint(e, pane)?.x || 0, startY: getOverlayPoint(e, pane)?.y || 0, startLogical: getOverlayPoint(e, pane)?.logical, startPrice: getOverlayPoint(e, pane)?.price, origItem: r };
          }
          const onMouseEnter = (e: ReactMouseEvent) => {
            if (activeTool === 'eraser' && e.buttons === 1) { e.stopPropagation(); pushUndoSnapshot(); setOverlayRects(prev => prev.filter(p => p.id !== r.id)); }
          }
          return (
            <g key={r.id} onClick={onClick} onMouseEnter={onMouseEnter} style={{ pointerEvents: 'all' }} className={activeTool === 'eraser' ? 'cursor-pointer' : 'cursor-move'} onMouseDown={(e) => onMouseDown(e, 'body')}>
              <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} fill="rgba(96,165,250,0.08)" stroke="transparent" strokeWidth="15" />
              <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} fill="transparent" stroke="#60A5FA" strokeWidth="1" pointerEvents="none" />
              {r.id === selectedOverlayId && (
                <>
                  <circle cx={x1} cy={y1} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, 'p1') }} />
                  <circle cx={x2} cy={y2} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, 'p2') }} />
                </>
              )}
            </g>
          )
        })}

        {showOverlays && overlayFibs.filter(f => (f.targetPane || 'primary') === pane).map((f) => {
          const x1 = f.logical1 !== undefined ? (currentApiRef.current?.timeScale().logicalToCoordinate(f.logical1 as any) ?? f.x1) : f.x1
          const y1 = f.price1 !== undefined ? (currentSeriesRef.current?.priceToCoordinate(f.price1) ?? f.y1) : f.y1
          const x2 = f.logical2 !== undefined ? (currentApiRef.current?.timeScale().logicalToCoordinate(f.logical2 as any) ?? f.x2) : f.x2
          const y2 = f.price2 !== undefined ? (currentSeriesRef.current?.priceToCoordinate(f.price2) ?? f.y2) : f.y2
          const top = Math.min(y1, y2), h = Math.abs(y2 - y1), left = Math.min(x1, x2), w = Math.abs(x2 - x1)
          const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
          const colors = ['#EF4444', '#F59E0B', '#22C55E', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444']
          const onClick = (e: ReactMouseEvent) => {
            if (activeTool === 'eraser') { e.stopPropagation(); pushUndoSnapshot(); setOverlayFibs(prev => prev.filter(p => p.id !== f.id)); return }
            e.stopPropagation(); setSelectedOverlayId(f.id); return
          }
          const onMouseDown = (e: ReactMouseEvent, type: 'p1' | 'p2' | 'body') => {
            if (activeTool === 'eraser') { e.stopPropagation(); pushUndoSnapshot(); setOverlayFibs(prev => prev.filter(p => p.id !== f.id)); return }
            if (activeTool === 'zoom') return;
            e.stopPropagation(); setSelectedOverlayId(f.id);
            dragStateRef.current = { id: f.id, collection: 'fibs', type, startX: getOverlayPoint(e, pane)?.x || 0, startY: getOverlayPoint(e, pane)?.y || 0, startLogical: getOverlayPoint(e, pane)?.logical, startPrice: getOverlayPoint(e, pane)?.price, origItem: f };
          }
          const onMouseEnter = (e: ReactMouseEvent) => {
            if (activeTool === 'eraser' && e.buttons === 1) { e.stopPropagation(); pushUndoSnapshot(); setOverlayFibs(prev => prev.filter(p => p.id !== f.id)); }
          }
          return (
            <g key={f.id} onClick={onClick} onMouseEnter={onMouseEnter} style={{ pointerEvents: 'all' }} className={activeTool === 'eraser' ? 'cursor-pointer' : 'cursor-move'} onMouseDown={(e) => onMouseDown(e, 'body')}>
              <rect x={left} y={top} width={w} height={h} fill="transparent" />
              {levels.map((lvl, idx) => {
                const y = top + h * lvl
                const nextY = idx < levels.length - 1 ? top + h * levels[idx + 1] : y
                return (
                  <g key={lvl}>
                    {idx < levels.length - 1 && <rect x={left} y={y} width={w} height={nextY - y} fill={colors[idx]} fillOpacity="0.05" pointerEvents="none" />}
                    <line x1={left} y1={y} x2={left + w} y2={y} stroke={colors[idx]} strokeWidth="1" pointerEvents="none" />
                    <rect x={left + w - 48} y={y - 7} width="46" height="13" rx="2" fill="#0B0E11" fillOpacity="0.85" pointerEvents="none" />
                    <text x={left + w - 44} y={y + 3} fill={colors[idx]} fontSize="9" fontFamily="monospace" pointerEvents="none">{(lvl * 100).toFixed(1)}%</text>
                  </g>
                )
              })}
              {f.id === selectedOverlayId && (
                <>
                  <circle cx={x1} cy={y1} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, 'p1') }} />
                  <circle cx={x2} cy={y2} r={4} fill="#0B0E11" stroke="#60A5FA" strokeWidth={1} style={{ cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, 'p2') }} />
                </>
              )}
            </g>
          )
        })}

        {showOverlays && overlayLabels.filter(lbl => (lbl.targetPane || 'primary') === pane).map((label) => {
          const x = label.logical !== undefined ? (currentApiRef.current?.timeScale().logicalToCoordinate(label.logical as any) ?? label.x) : label.x
          const y = label.price !== undefined ? (currentSeriesRef.current?.priceToCoordinate(label.price) ?? label.y) : label.y
          const onClick = (e: ReactMouseEvent) => { if (activeTool === 'eraser') { e.stopPropagation(); pushUndoSnapshot(); setOverlayLabels((prev) => prev.filter(p => p.id !== label.id)) } }
          const onMouseDown = (e: ReactMouseEvent) => { if (activeTool === 'eraser') { e.stopPropagation(); pushUndoSnapshot(); setOverlayLabels((prev) => prev.filter(p => p.id !== label.id)) } }
          const onMouseEnter = (e: ReactMouseEvent) => { if (activeTool === 'eraser' && e.buttons === 1) { e.stopPropagation(); pushUndoSnapshot(); setOverlayLabels((prev) => prev.filter(p => p.id !== label.id)) } }
          const textMetrics = 50
          return (
            <g key={label.id} onClick={onClick} onMouseDown={onMouseDown} onMouseEnter={onMouseEnter} className={activeTool === 'eraser' ? 'cursor-pointer' : ''}>
              <rect x={x - textMetrics / 2} y={y - 12} width={textMetrics} height={24} fill="transparent" />
              <text x={x} y={y} fill="#D9DEE3" fontSize="11" style={{ userSelect: 'none', pointerEvents: 'none' }} textAnchor="middle" alignmentBaseline="middle">
                {label.text}
              </text>
            </g>
          )
        })}

        {showOverlays && draftStart && hoverPoint && (draftStart.targetPane || 'primary') === pane && (activeTool === 'line' || activeTool === 'ray' || activeTool === 'xline' || activeTool === 'arrow' || activeTool === 'infoline' || activeTool === 'angle') && (
          <line x1={draftStart.x} y1={draftStart.y} x2={hoverPoint.x} y2={hoverPoint.y} stroke="#93C5FD" strokeWidth="1.5" strokeDasharray="4 3" />
        )}
        {showOverlays && draftStart && hoverPoint && (draftStart.targetPane || 'primary') === pane && activeTool === 'rect' && (
          <rect x={Math.min(draftStart.x, hoverPoint.x)} y={Math.min(draftStart.y, hoverPoint.y)} width={Math.abs(hoverPoint.x - draftStart.x)} height={Math.abs(hoverPoint.y - draftStart.y)} fill="rgba(96,165,250,0.06)" stroke="#93C5FD" strokeWidth="1" strokeDasharray="4 3" />
        )}
        {showOverlays && draftStart && hoverPoint && (draftStart.targetPane || 'primary') === pane && activeTool === 'fib' && (() => {
          const ft = Math.min(draftStart.y, hoverPoint.y), fh = Math.abs(hoverPoint.y - draftStart.y), fl = Math.min(draftStart.x, hoverPoint.x), fw = Math.abs(hoverPoint.x - draftStart.x)
          return (
            <g>
              {[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map((lvl) => (
                <line key={lvl} x1={fl} y1={ft + fh * lvl} x2={fl + fw} y2={ft + fh * lvl} stroke="#A78BFA" strokeWidth="0.6" strokeDasharray="4 3" opacity="0.6" />
              ))}
            </g>
          )
        })()}
      </g>

      {/* ─── MEASURE TOOL (Outside clipPath) ─── */}
      {showOverlays && measureStart && (measureEnd || hoverPoint) && (measureStart.targetPane || 'primary') === pane && activeTool === 'measure' && (() => {
        const end = measureEnd ?? hoverPoint!
        const minX = Math.min(measureStart.x, end.x), maxX = Math.max(measureStart.x, end.x)
        const minY = Math.min(measureStart.y, end.y), maxY = Math.max(measureStart.y, end.y)
        const w = maxX - minX, h = maxY - minY
        const svgW = currentOverlayRef.current?.clientWidth ?? 800
        const rightScaleW = 60

        let priceStr = '', pctStr = '', barsStr = '', timeStr2 = ''
        let isPositive = true

        try {
          const price1 = currentSeriesRef.current?.coordinateToPrice(measureStart.y)
          const price2 = currentSeriesRef.current?.coordinateToPrice(end.y)
          const logical1 = currentApiRef.current?.timeScale().coordinateToLogical(measureStart.x)
          const logical2 = currentApiRef.current?.timeScale().coordinateToLogical(end.x)

          if (price1 != null && price2 != null) {
            const diff = price2 - price1
            isPositive = diff >= 0
            const pct = (diff / price1) * 100
            priceStr = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`
            pctStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
            if (logical1 != null && logical2 != null) {
              const bars = Math.abs(Math.round(logical2 - logical1))
              const secs = bars * timeframeToSeconds[interval]
              if (secs < 60) timeStr2 = `${secs}s`
              else if (secs < 3600) timeStr2 = `${Math.floor(secs / 60)}m`
              else if (secs < 86400) timeStr2 = `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
              else timeStr2 = `${Math.floor(secs / 86400)}d`
              barsStr = `${bars} bars  ·  ${timeStr2}`
            }
          }
        } catch (_) {}

        const baseColor = isPositive ? '#00C076' : '#FF3B30'
        const fillColor = isPositive ? 'rgba(0,192,118,0.08)' : 'rgba(255,59,48,0.08)'
        const borderColor = isPositive ? 'rgba(0,192,118,0.4)' : 'rgba(255,59,48,0.4)'

        // Tooltip card
        const cardW = 148
        const cardH = barsStr ? 72 : 52
        const cardX = Math.min(minX + w / 2 - cardW / 2, svgW - cardW - rightScaleW - 4)
        const cardY = maxY + 12 + cardH < (clipHLocal ?? 500) ? maxY + 12 : minY - cardH - 12

        // Price scale labels
        const topPrice = measureStart.y < end.y
          ? currentSeriesRef.current?.coordinateToPrice(minY)?.toFixed(2)
          : currentSeriesRef.current?.coordinateToPrice(maxY)?.toFixed(2)
        const bottomPrice = measureStart.y < end.y
          ? currentSeriesRef.current?.coordinateToPrice(maxY)?.toFixed(2)
          : currentSeriesRef.current?.coordinateToPrice(minY)?.toFixed(2)

        return (
          <g>
            {/* Selection rectangle */}
            <rect x={minX} y={minY} width={w} height={h} fill={fillColor} stroke={borderColor} strokeWidth="1" strokeDasharray="5 3" rx="2" />
            {/* Corner anchor dots */}
            {[[minX, minY], [maxX, minY], [minX, maxY], [maxX, maxY]].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r={3} fill={baseColor} opacity={0.8} pointerEvents="none" />
            ))}
            {/* Horizontal measurement arrow */}
            {w > 20 && (
              <g pointerEvents="none">
                <line x1={minX} y1={maxY + 6} x2={maxX} y2={maxY + 6} stroke={baseColor} strokeWidth="1" opacity="0.6" />
                <polygon points={`${minX},${maxY + 6} ${minX + 6},${maxY + 3} ${minX + 6},${maxY + 9}`} fill={baseColor} opacity="0.6" />
                <polygon points={`${maxX},${maxY + 6} ${maxX - 6},${maxY + 3} ${maxX - 6},${maxY + 9}`} fill={baseColor} opacity="0.6" />
              </g>
            )}
            {/* Vertical measurement arrow */}
            {h > 20 && (
              <g pointerEvents="none">
                <line x1={maxX + 6} y1={minY} x2={maxX + 6} y2={maxY} stroke={baseColor} strokeWidth="1" opacity="0.6" />
                <polygon points={`${maxX + 6},${minY} ${maxX + 3},${minY + 6} ${maxX + 9},${minY + 6}`} fill={baseColor} opacity="0.6" />
                <polygon points={`${maxX + 6},${maxY} ${maxX + 3},${maxY - 6} ${maxX + 9},${maxY - 6}`} fill={baseColor} opacity="0.6" />
              </g>
            )}

            {/* Price scale highlight bar */}
            {topPrice && bottomPrice && (
              <g pointerEvents="none">
                <rect x={svgW - rightScaleW} y={minY} width={rightScaleW} height={h} fill={fillColor} stroke={borderColor} strokeWidth="0.5" />
                {/* top price label */}
                <rect x={svgW - rightScaleW} y={minY - 11} width={rightScaleW} height={22} rx="3" fill={baseColor} />
                <text x={svgW - rightScaleW / 2} y={minY + 5} fill="#FFF" fontSize="10.5" textAnchor="middle" fontFamily="ui-monospace,monospace" fontWeight="600">{minY < maxY ? topPrice : bottomPrice}</text>
                {/* bottom price label */}
                <rect x={svgW - rightScaleW} y={maxY - 11} width={rightScaleW} height={22} rx="3" fill={baseColor} />
                <text x={svgW - rightScaleW / 2} y={maxY + 5} fill="#FFF" fontSize="10.5" textAnchor="middle" fontFamily="ui-monospace,monospace" fontWeight="600">{minY < maxY ? bottomPrice : topPrice}</text>
                {/* dashed leaders */}
                <line x1={maxX} y1={minY} x2={svgW - rightScaleW} y2={minY} stroke={baseColor} strokeDasharray="3 3" strokeWidth="0.7" opacity="0.5" />
                <line x1={maxX} y1={maxY} x2={svgW - rightScaleW} y2={maxY} stroke={baseColor} strokeDasharray="3 3" strokeWidth="0.7" opacity="0.5" />
              </g>
            )}

            {/* Tooltip card */}
            {priceStr && (
              <g pointerEvents="none">
                {/* Card shadow */}
                <rect x={cardX + 2} y={cardY + 2} width={cardW} height={cardH} rx="6" fill="rgba(0,0,0,0.4)" />
                {/* Card body */}
                <rect x={cardX} y={cardY} width={cardW} height={cardH} rx="6" fill="#0F1218" stroke={borderColor} strokeWidth="1.2" />
                {/* Colored header strip */}
                <rect x={cardX} y={cardY} width={cardW} height={24} rx="6" fill={baseColor} />
                <rect x={cardX} y={cardY + 18} width={cardW} height={6} fill={baseColor} />
                {/* Price + pct in header */}
                <text x={cardX + cardW / 2} y={cardY + 15} fill="#FFF" fontSize="12" fontFamily="ui-monospace,monospace" textAnchor="middle" fontWeight="700">{priceStr}  {pctStr}</text>
                {/* Bars row */}
                {barsStr && (
                  <text x={cardX + cardW / 2} y={cardY + 42} fill="#AAB0B6" fontSize="10" fontFamily="ui-monospace,monospace" textAnchor="middle">{barsStr}</text>
                )}
                {/* Price diff label */}
                {barsStr && (
                  <text x={cardX + cardW / 2} y={cardY + 60} fill="#657080" fontSize="9" textAnchor="middle" fontFamily="system-ui,sans-serif">Δ price  ·  time span</text>
                )}
                {!barsStr && (
                  <text x={cardX + cardW / 2} y={cardY + 44} fill="#657080" fontSize="9" textAnchor="middle" fontFamily="system-ui,sans-serif">price change</text>
                )}
              </g>
            )}
          </g>
        )
      })()}

      {showOverlays && draftStart && hoverPoint && activePane === pane && activeTool === 'zoom' && (
        <rect x={Math.min(draftStart.x, hoverPoint.x)} y={Math.min(draftStart.y, hoverPoint.y)} width={Math.abs(hoverPoint.x - draftStart.x)} height={Math.abs(hoverPoint.y - draftStart.y)} fill="rgba(0, 192, 118, 0.1)" stroke="#00C076" strokeWidth="1" strokeDasharray="4 4" />
      )}
    </svg>
  )
}
