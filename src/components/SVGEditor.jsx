// SVGEditor.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Square, Circle, Trash2, RotateCcw, ChevronUp, ChevronDown, Eye, EyeOff, Loader } from 'lucide-react';

const SVGEditor = () => {
  const [shapes, setShapes] = useState([]);
  const [currentShape, setCurrentShape] = useState(null);
  const [selectedShape, setSelectedShape] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [currentTool, setCurrentTool] = useState('rect');
  const [resizeHandle, setResizeHandle] = useState(null);
  const [currentColor, setCurrentColor] = useState('#FF0000');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const svgRef = useRef(null);

  useEffect(() => {
    if (selectedShape) {
      setCurrentColor(selectedShape.fill);
    }
  }, [selectedShape]);

  const getMousePosition = (event) => {
    const svg = svgRef.current;
    const CTM = svg.getScreenCTM();
    return {
      x: (event.clientX - CTM.e) / CTM.a,
      y: (event.clientY - CTM.f) / CTM.d
    };
  };

  const generateSVG = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3000/api/generate-svg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate SVG');
      }

      const svgResponse = await fetch(`http://localhost:3000/${data.svg}`);
      const svgText = await svgResponse.text();
      importSVGContent(svgText);

    } catch (err) {
      setError(err.message);
      console.error('Error generating SVG:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const importSVGContent = (svgString) => {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;

    const viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
      svgRef.current.setAttribute('viewBox', viewBox);
    }

    const elements = svgElement.querySelectorAll('path, rect, circle, ellipse');
    const newShapes = Array.from(elements).map((el, index) => {
      const type = el.tagName.toLowerCase();
      const commonProps = {
        id: `imported-${Date.now()}-${index}`,
        type,
        fill: el.getAttribute('fill') || '#000000',
        stroke: el.getAttribute('stroke'),
        strokeWidth: el.getAttribute('stroke-width'),
        visible: true,
        name: `Imported ${type} ${index + 1}`,
        isImported: true,
        rotation: 0,
      };

      switch (type) {
        case 'path':
          return {
            ...commonProps,
            d: el.getAttribute('d'),
          };
        case 'rect':
          return {
            ...commonProps,
            x: parseFloat(el.getAttribute('x') || 0),
            y: parseFloat(el.getAttribute('y') || 0),
            width: parseFloat(el.getAttribute('width') || 0),
            height: parseFloat(el.getAttribute('height') || 0),
          };
        case 'circle': {
          const cx = parseFloat(el.getAttribute('cx') || 0);
          const cy = parseFloat(el.getAttribute('cy') || 0);
          const r = parseFloat(el.getAttribute('r') || 0);
          return {
            ...commonProps,
            x: cx - r,
            y: cy - r,
            width: r * 2,
            height: r * 2,
          };
        }
        default:
          return null;
      }
    }).filter(Boolean);

    setShapes(prevShapes => [...prevShapes, ...newShapes]);
  };

  const handleMouseDown = (event) => {
    const target = event.target;
    if (target === svgRef.current) {
      const point = getMousePosition(event);
      if (currentTool) {
        setCurrentShape({
          type: currentTool,
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
          rotation: 0,
          fill: currentColor,
          visible: true,
          id: Date.now(),
          name: `${currentTool.charAt(0).toUpperCase() + currentTool.slice(1)} ${shapes.length + 1}`
        });
        setSelectedShape(null);
      }
    } else if (target.classList.contains('resize-handle')) {
      setIsResizing(true);
      setResizeHandle(target.dataset.handle);
    } else if (target.classList.contains('shape')) {
      const shape = shapes.find(s => s.id === parseInt(target.id));
      setSelectedShape(shape);
      setIsDragging(true);
    }
  };

  const handleMouseMove = (event) => {
    const point = getMousePosition(event);

    if (currentShape) {
      setCurrentShape(prev => ({
        ...prev,
        width: point.x - prev.x,
        height: point.y - prev.y
      }));
    } else if (isDragging && selectedShape) {
      setShapes(prevShapes =>
        prevShapes.map(shape =>
          shape.id === selectedShape.id
            ? {
                ...shape,
                x: point.x - (shape.width / 2),
                y: point.y - (shape.height / 2)
              }
            : shape
        )
      );
    } else if (isResizing && selectedShape) {
      const shape = selectedShape;
      const dx = point.x - (shape.x + shape.width);
      const dy = point.y - (shape.y + shape.height);

      setShapes(prevShapes =>
        prevShapes.map(s => {
          if (s.id === shape.id) {
            let newShape = { ...s };
            switch (resizeHandle) {
              case 'se':
                newShape.width += dx;
                newShape.height += dy;
                break;
              case 'sw':
                newShape.x += dx;
                newShape.width -= dx;
                newShape.height += dy;
                break;
              case 'ne':
                newShape.y += dy;
                newShape.width += dx;
                newShape.height -= dy;
                break;
              case 'nw':
                newShape.x += dx;
                newShape.y += dy;
                newShape.width -= dx;
                newShape.height -= dy;
                break;
            }
            return newShape;
          }
          return s;
        })
      );
    }
  };

  const handleMouseUp = () => {
    if (currentShape) {
      setShapes(prev => [...prev, currentShape]);
      setCurrentShape(null);
    }
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  };

  const deleteSelected = () => {
    if (selectedShape) {
      setShapes(shapes.filter(shape => shape.id !== selectedShape.id));
      setSelectedShape(null);
    }
  };

  const rotateSelected = () => {
    if (selectedShape) {
      setShapes(shapes.map(shape =>
        shape.id === selectedShape.id
          ? { ...shape, rotation: (shape.rotation || 0) + 45 }
          : shape
      ));
    }
  };

  const toggleShapeVisibility = (shapeId) => {
    setShapes(shapes.map(shape =>
      shape.id === shapeId
        ? { ...shape, visible: !shape.visible }
        : shape
    ));
  };

  const moveLayer = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= shapes.length) return;
    const newShapes = [...shapes];
    const [movedShape] = newShapes.splice(fromIndex, 1);
    newShapes.splice(toIndex, 0, movedShape);
    setShapes(newShapes);
  };

  const renderResizeHandles = (shape) => {
    const handles = ['nw', 'ne', 'se', 'sw'];
    const positions = {
      nw: { x: 0, y: 0 },
      ne: { x: shape.width, y: 0 },
      se: { x: shape.width, y: shape.height },
      sw: { x: 0, y: shape.height }
    };

    return handles.map(handle => (
      <circle
        key={handle}
        className="resize-handle"
        cx={shape.x + positions[handle].x}
        cy={shape.y + positions[handle].y}
        r="4"
        fill="#2196f3"
        data-handle={handle}
        style={{ cursor: 'pointer' }}
      />
    ));
  };

  const renderShape = (shape) => {
    const isSelected = selectedShape && selectedShape.id === shape.id;
    const transform = `rotate(${shape.rotation || 0} ${shape.x + shape.width / 2} ${shape.y + shape.height / 2})`;
    const commonProps = {
      id: shape.id.toString(),
      className: "shape",
      stroke: shape.stroke || (isSelected ? '#2196f3' : '#000'),
      strokeWidth: shape.strokeWidth || (isSelected ? 2 : 1),
      fill: shape.fill,
      cursor: 'move',
      transform
    };

    return (
      <g key={shape.id}>
        {shape.type === 'path' ? (
          <path {...commonProps} d={shape.d} />
        ) : shape.type === 'rect' ? (
          <rect
            {...commonProps}
            x={shape.x}
            y={shape.y}
            width={Math.abs(shape.width)}
            height={Math.abs(shape.height)}
          />
        ) : (
          <circle
            {...commonProps}
            cx={shape.x + shape.width / 2}
            cy={shape.y + shape.height / 2}
            r={Math.max(Math.abs(shape.width), Math.abs(shape.height)) / 2}
          />
        )}
        {isSelected && renderResizeHandles(shape)}
      </g>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      {/* Prompt Input Section */}
      <div className="mb-8 w-full">
        <div className="flex gap-4 items-start">
          <div className="flex-1">
            <textarea
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows="3"
              placeholder="Enter your prompt to generate an SVG..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
          </div>
          <button
            className={`px-6 py-3 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
              isLoading ? 'cursor-not-allowed' : ''
            }`}
            onClick={generateSVG}
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate SVG'
            )}
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Layer Panel */}
        <div className="w-64 bg-white rounded-lg shadow p-4">
          <h3 className="font-bold text-lg mb-4">Layers</h3>
          <div className="space-y-2">
            {shapes.map((shape, index) => (
              <div
                key={shape.id}
                className={`flex items-center p-2 rounded ${
                  selectedShape?.id === shape.id ? 'bg-blue-100' : 'hover:bg-gray-100'
                } ${shape.isImported ? 'border-l-4 border-blue-500' : ''}`}
                onClick={() => setSelectedShape(shape)}
              >
                <button
                  className="p-1 hover:bg-gray-200 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleShapeVisibility(shape.id);
                  }}
                >
                  {shape.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <span className="flex-1 mx-2 truncate">{shape.name}</span>
                <div className="flex gap-1">
                  <button
                    className="p-1 hover:bg-gray-200 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(index, index + 1);
                    }}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    className="p-1 hover:bg-gray-200 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(index, index - 1);
                    }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1">
          <div className="mb-4 flex gap-4 items-center">
            <button
              className={`p-2 border rounded ${currentTool === 'rect' ? 'bg-blue-100' : ''}`}
              onClick={() => setCurrentTool('rect')}
            >
              <Square className="w-6 h-6" />
            </button>
            <button
              className={`p-2 border rounded ${currentTool === 'circle' ? 'bg-blue-100' : ''}`}
              onClick={() => setCurrentTool('circle')}
            >
              <Circle className="w-6 h-6" />
            </button>
            <input
              type="color"
              value={currentColor}
              onChange={(e) => {
                setCurrentColor(e.target.value);
                if (selectedShape) {
                  setShapes(shapes.map(shape =>
                    shape.id === selectedShape.id
                      ? { ...shape, fill: e.target.value }
                      : shape
                  ));
                }
              }}
              className="w-12 h-10 p-1 border rounded"
            />
            <button
              className="p-2 border rounded hover:bg-red-100"
              onClick={deleteSelected}
              disabled={!selectedShape}
            >
              <Trash2 className="w-6 h-6" />
            </button>
            <button
              className="p-2 border rounded hover:bg-blue-100"
              onClick={rotateSelected}
              disabled={!selectedShape}
            >
              <RotateCcw className="w-6 h-6" />
            </button>
          </div>
          <svg
            ref={svgRef}
            className="w-full h-[1024px] border border-gray-300 rounded bg-white"
            viewBox="0 0 2048 2048"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {shapes.filter(shape => shape.visible).map(shape => renderShape(shape))}
            {currentShape && renderShape(currentShape)}
          </svg>
        </div>
      </div>
    </div>
  );
};

export default SVGEditor;
