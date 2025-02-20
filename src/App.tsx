import React, { useEffect, useRef, useState } from 'react';
import { Canvas, IText, Rect, Pattern, Polygon, Line, Path, Object as FabricObject } from 'fabric';
import './App.css';

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  objects: FabricObject[];
}

// Extend Canvas events with custom history events
declare module 'fabric' {
  interface CanvasEvents {
    'history:append': any;
    'history:undo': any;
    'history:redo': any;
  }

  interface Canvas {
    historyUndo?: string[];
    historyRedo?: string[];
  }
}

type BackgroundType = 'plain' | 'grid' | 'lines';
type ShapeType = 'rectangle' | 'triangle' | 'trapezoid' | 'line' | 'stairs' | 'elevator' | 'entrance';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const [mode, setMode] = useState<'select' | ShapeType | 'text'>('select');
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('plain');
  const [backgroundColor, setBackgroundColor] = useState('#f0f0f0');
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [roomColor, setRoomColor] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#000000');
  const [roomBorderColor, setRoomBorderColor] = useState('#000000');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [objectsToDelete, setObjectsToDelete] = useState<FabricObject[]>([]);
  const [layers, setLayers] = useState<Layer[]>([
    { id: '1', name: 'Layer 1', visible: true, locked: false, objects: [] }
  ]);
  const [activeLayer, setActiveLayer] = useState<string>('1');
  const [showGuides, setShowGuides] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const guidesRef = useRef<FabricObject[]>([]);

  const createGuides = (canvas: Canvas) => {
    // Clear existing guides
    guidesRef.current.forEach(guide => canvas.remove(guide));
    guidesRef.current = [];

    // Create horizontal guides
    for (let i = gridSize; i < canvas.height!; i += gridSize) {
      const horizontalGuide = new Line([0, i, canvas.width!, i], {
        stroke: '#2196f3',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        opacity: 0.5,
        visible: showGuides
      });
      canvas.add(horizontalGuide);
      guidesRef.current.push(horizontalGuide);
    }

    // Create vertical guides
    for (let i = gridSize; i < canvas.width!; i += gridSize) {
      const verticalGuide = new Line([i, 0, i, canvas.height!], {
        stroke: '#2196f3',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        opacity: 0.5,
        visible: showGuides
      });
      canvas.add(verticalGuide);
      guidesRef.current.push(verticalGuide);
    }

    canvas.renderAll();
  };

  const createGridPattern = (canvas: Canvas, type: BackgroundType) => {
    if (!canvas || !canvas.getContext()) return;

    // Store existing objects (excluding guides)
    const objects = canvas.getObjects().filter(obj => {
      const isBackground = obj.get('absolutePositioned') === true;
      const isGuide = guidesRef.current.includes(obj);
      return !isBackground && !isGuide;
    });
    
    // Clear canvas
    canvas.clear();
    canvas.backgroundColor = backgroundColor;
    
    if (type === 'plain') {
      // Restore objects for plain background
      objects.forEach(obj => canvas.add(obj));
      createGuides(canvas);
      canvas.renderAll();
      return;
    }

    // Create pattern
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = gridSize;
    patternCanvas.height = gridSize;
    const patternCtx = patternCanvas.getContext('2d');

    if (!patternCtx) return;

    patternCtx.strokeStyle = '#ccc';
    patternCtx.lineWidth = 0.5;

    if (type === 'grid') {
      // Draw vertical line
      patternCtx.beginPath();
      patternCtx.moveTo(gridSize, 0);
      patternCtx.lineTo(gridSize, gridSize);
      patternCtx.stroke();

      // Draw horizontal line
      patternCtx.beginPath();
      patternCtx.moveTo(0, gridSize);
      patternCtx.lineTo(gridSize, gridSize);
      patternCtx.stroke();
    } else if (type === 'lines') {
      // Draw only horizontal lines
      patternCtx.beginPath();
      patternCtx.moveTo(0, gridSize);
      patternCtx.lineTo(gridSize, gridSize);
      patternCtx.stroke();
    }

    // Create background rect with pattern
    const backgroundRect = new Rect({
      left: 0,
      top: 0,
      width: canvas.width || 0,
      height: canvas.height || 0,
      fill: new Pattern({
        source: patternCanvas,
        repeat: 'repeat'
      }),
      selectable: false,
      evented: false,
      absolutePositioned: true
    });

    // Add background rect first
    canvas.add(backgroundRect);

    // Restore other objects
    objects.forEach(obj => canvas.add(obj));
    
    createGuides(canvas);
    canvas.renderAll();
  };

  const updateCanvasSize = (width: number, height: number) => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.setWidth(width);
      fabricCanvasRef.current.setHeight(height);
      setCanvasSize({ width, height });
      createGridPattern(fabricCanvasRef.current, backgroundType);
      createGuides(fabricCanvasRef.current);
    }
  };

  // Update active object color
  const updateSelectedObjectColor = (color: string) => {
    if (fabricCanvasRef.current) {
      const activeObject = fabricCanvasRef.current.getActiveObject();
      if (activeObject) {
        if (activeObject instanceof IText) {
          activeObject.set('fill', color);
        } else {
          activeObject.set('fill', color);
        }
        fabricCanvasRef.current.renderAll();
      }
    }
  };

  // State history management
  const saveState = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.fire('history:append');
      updateUndoRedoState();
    }
  };

  const updateUndoRedoState = () => {
    if (fabricCanvasRef.current) {
      const canvas = fabricCanvasRef.current;
      setCanUndo((canvas.historyUndo?.length ?? 0) > 0);
      setCanRedo((canvas.historyRedo?.length ?? 0) > 0);
    }
  };

  const undo = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.fire('history:undo');
      updateUndoRedoState();
    }
  };

  const redo = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.fire('history:redo');
      updateUndoRedoState();
    }
  };

  // Initialize history management
  const initHistory = (canvas: Canvas) => {
    // Initialize history arrays
    canvas.historyUndo = [];
    canvas.historyRedo = [];

    canvas.on('history:append', () => {
      const state = JSON.stringify(canvas.toJSON());
      canvas.historyUndo?.push(state);
      canvas.historyRedo = [];
      updateUndoRedoState();
    });

    canvas.on('history:undo', () => {
      const undoStack = canvas.historyUndo;
      if (!undoStack?.length) return;
      
      const currentState = JSON.stringify(canvas.toJSON());
      canvas.historyRedo?.push(currentState);
      
      const previousState = undoStack.pop();
      if (previousState) {
        canvas.loadFromJSON(JSON.parse(previousState), () => {
          canvas.renderAll();
          updateUndoRedoState();
        });
      }
    });

    canvas.on('history:redo', () => {
      const redoStack = canvas.historyRedo;
      if (!redoStack?.length) return;
      
      const currentState = JSON.stringify(canvas.toJSON());
      canvas.historyUndo?.push(currentState);
      
      const nextState = redoStack.pop();
      if (nextState) {
        canvas.loadFromJSON(JSON.parse(nextState), () => {
          canvas.renderAll();
          updateUndoRedoState();
        });
      }
    });

    // Save initial state
    canvas.fire('history:append');
  };

  const addShape = (type: ShapeType) => {
    if (!fabricCanvasRef.current) return;

    let shape: FabricObject | undefined;
    const canvas = fabricCanvasRef.current;

    switch (type) {
      case 'rectangle':
        shape = new Rect({
          left: 100,
          top: 100,
          width: 100,
          height: 100,
          fill: roomColor,
          stroke: roomBorderColor,
          strokeWidth: 1
        });
        break;

      case 'triangle':
        shape = new Polygon([
          { x: 0, y: 100 },
          { x: 50, y: 0 },
          { x: 100, y: 100 }
        ], {
          left: 100,
          top: 100,
          fill: roomColor,
          stroke: roomBorderColor,
          strokeWidth: 1
        });
        break;

      case 'trapezoid':
        shape = new Polygon([
          { x: 20, y: 0 },
          { x: 80, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ], {
          left: 100,
          top: 100,
          fill: roomColor,
          stroke: roomBorderColor,
          strokeWidth: 1,
          scaleX: 1.5,
          scaleY: 1.5
        });
        break;

      case 'line':
        shape = new Line([50, 50, 200, 50], {
          stroke: roomBorderColor,
          strokeWidth: 2
        });
        break;

      case 'stairs':
        // Create stairs symbol
        const stairsPath = 'M 0 0 L 100 0 L 100 20 L 80 20 L 80 40 L 60 40 L 60 60 L 40 60 L 40 80 L 20 80 L 20 100 L 0 100 Z';
        shape = new Path(stairsPath, {
          left: 100,
          top: 100,
          fill: roomColor,
          stroke: roomBorderColor,
          strokeWidth: 1,
          scaleX: 0.5,
          scaleY: 0.5
        });
        break;

      case 'elevator':
        // Create elevator symbol (double rectangle)
        const outerRect = new Rect({
          left: 100,
          top: 100,
          width: 60,
          height: 60,
          fill: roomColor,
          stroke: roomBorderColor,
          strokeWidth: 1
        });
        const innerRect = new Rect({
          left: 110,
          top: 110,
          width: 40,
          height: 40,
          fill: 'transparent',
          stroke: roomBorderColor,
          strokeWidth: 1
        });
        canvas.add(outerRect, innerRect);
        canvas.renderAll();
        return;

      case 'entrance':
        // Create entrance symbol (arrow)
        const arrowPath = 'M 0 20 L 40 20 L 40 0 L 60 25 L 40 50 L 40 30 L 0 30 Z';
        shape = new Path(arrowPath, {
          left: 100,
          top: 100,
          fill: roomColor,
          stroke: roomBorderColor,
          strokeWidth: 1,
          scaleX: 0.8,
          scaleY: 0.8
        });
        break;

      default:
        return;
    }

    if (shape) {
      // Add the shape to both canvas and layer
      canvas.add(shape);
      setLayers(layers.map(layer => {
        if (layer.id === activeLayer && shape) {
          return { ...layer, objects: [...layer.objects, shape] };
        }
        return layer;
      }));
      canvas.setActiveObject(shape);
      canvas.renderAll();
      saveState();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Delete' && fabricCanvasRef.current) {
      e.preventDefault();
      const activeObjects = fabricCanvasRef.current.getActiveObjects();
      if (activeObjects.length > 0) {
        if (activeObjects.length === 1) {
          deleteObjects(activeObjects);
        } else {
          setObjectsToDelete(activeObjects);
          setShowDeleteConfirm(true);
        }
      }
    }
  };

  const deleteObjects = (objects: FabricObject[]) => {
    if (fabricCanvasRef.current) {
      const canvas = fabricCanvasRef.current;
      objects.forEach(obj => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.renderAll();
      saveState();
    }
  };

  const deleteSelected = () => {
    if (fabricCanvasRef.current) {
      const activeObjects = fabricCanvasRef.current.getActiveObjects();
      
      if (activeObjects.length > 0) {
        if (activeObjects.length === 1) {
          deleteObjects(activeObjects);
        } else {
          setObjectsToDelete(activeObjects);
          setShowDeleteConfirm(true);
        }
      }
    }
  };

  useEffect(() => {
    // Initialize canvas only once
    if (canvasRef.current && !fabricCanvasRef.current) {
      fabricCanvasRef.current = new Canvas(canvasRef.current, {
        width: canvasSize.width,
        height: canvasSize.height,
        backgroundColor: backgroundColor
      });

      // Initialize history management
      initHistory(fabricCanvasRef.current);

      // Initial background and guides
      createGridPattern(fabricCanvasRef.current, backgroundType);
      createGuides(fabricCanvasRef.current);

      // Add object selection event listener
      fabricCanvasRef.current.on('selection:created', (e) => {
        const selectedObject = e.selected?.[0];
        if (selectedObject instanceof IText) {
          setTextColor(selectedObject.fill as string);
        } else if ((selectedObject instanceof Rect || selectedObject instanceof Polygon || selectedObject instanceof Path) 
          && !selectedObject.get('absolutePositioned')) {
          setRoomColor(selectedObject.fill as string);
          setRoomBorderColor(selectedObject.stroke as string);
        }
      });

      // Add object modification listeners
      fabricCanvasRef.current.on('object:modified', () => {
        saveState();
      });

      // Add keyboard event listener
      window.addEventListener('keydown', handleKeyDown);
    }

    // Cleanup
    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (fabricCanvasRef.current) {
      createGridPattern(fabricCanvasRef.current, backgroundType);
    }
  }, [backgroundType, backgroundColor]);

  const addText = () => {
    if (fabricCanvasRef.current) {
      const text = new IText('Room Name', {
        left: 100,
        top: 100,
        fontSize: 16,
        fill: textColor
      });
      fabricCanvasRef.current.add(text);
      fabricCanvasRef.current.setActiveObject(text);
      fabricCanvasRef.current.renderAll();
      saveState();
    }
  };

  const exportAsPNG = () => {
    if (fabricCanvasRef.current) {
      const dataURL = fabricCanvasRef.current.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1
      });
      const link = document.createElement('a');
      link.download = 'floor-plan.png';
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const exportAsSVG = () => {
    if (fabricCanvasRef.current) {
      const svg = fabricCanvasRef.current.toSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'floor-plan.svg';
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const exportAsJSON = () => {
    if (fabricCanvasRef.current) {
      const json = fabricCanvasRef.current.toJSON();
      const jsonStr = JSON.stringify(json);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'floor-plan.json';
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // Add layer management functions
  const addLayer = () => {
    const newLayer: Layer = {
      id: Date.now().toString(),
      name: `Layer ${layers.length + 1}`,
      visible: true,
      locked: false,
      objects: []
    };
    setLayers([...layers, newLayer]);
    setActiveLayer(newLayer.id);
  };

  const toggleLayerVisibility = (layerId: string) => {
    setLayers(layers.map(layer => {
      if (layer.id === layerId) {
        if (fabricCanvasRef.current) {
          layer.objects.forEach(obj => {
            obj.visible = !layer.visible;
          });
          fabricCanvasRef.current.renderAll();
        }
        return { ...layer, visible: !layer.visible };
      }
      return layer;
    }));
  };

  const toggleLayerLock = (layerId: string) => {
    setLayers(layers.map(layer => {
      if (layer.id === layerId) {
        if (fabricCanvasRef.current) {
          layer.objects.forEach(obj => {
            obj.selectable = layer.locked;
            obj.evented = layer.locked;
          });
          fabricCanvasRef.current.renderAll();
        }
        return { ...layer, locked: !layer.locked };
      }
      return layer;
    }));
  };

  const deleteLayer = (layerId: string) => {
    if (layers.length === 1) {
      alert('Cannot delete the last layer');
      return;
    }

    const layerToDelete = layers.find(l => l.id === layerId);
    if (layerToDelete && fabricCanvasRef.current) {
      layerToDelete.objects.forEach(obj => {
        fabricCanvasRef.current?.remove(obj);
      });
      fabricCanvasRef.current.renderAll();
    }

    const newLayers = layers.filter(l => l.id !== layerId);
    setLayers(newLayers);
    if (activeLayer === layerId) {
      setActiveLayer(newLayers[0].id);
    }
  };

  const renameLayer = (layerId: string, newName: string) => {
    setLayers(layers.map(layer => 
      layer.id === layerId ? { ...layer, name: newName } : layer
    ));
  };

  // Add guide management functions
  const toggleGuides = () => {
    setShowGuides(!showGuides);
    if (fabricCanvasRef.current) {
      guidesRef.current.forEach(guide => {
        guide.set('visible', !showGuides);
      });
      fabricCanvasRef.current.renderAll();
    }
  };

  const toggleSnapToGrid = () => {
    setSnapToGrid(!snapToGrid);
  };

  const updateGridSize = (size: number) => {
    setGridSize(size);
    if (fabricCanvasRef.current) {
      createGridPattern(fabricCanvasRef.current, backgroundType);
      createGuides(fabricCanvasRef.current);
    }
  };

  // Modify object movement to snap to grid
  useEffect(() => {
    if (fabricCanvasRef.current && snapToGrid) {
      fabricCanvasRef.current.on('object:moving', (e) => {
        if (!e.target) return;
        
        const target = e.target;
        target.set({
          left: Math.round(target.left! / gridSize) * gridSize,
          top: Math.round(target.top! / gridSize) * gridSize
        });
      });
    }
  }, [snapToGrid, gridSize]);

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <div className="tools-sidebar">
        {/* History Controls */}
        <div>
          <div className="section-title">History</div>
          <div className="button-group">
            <button 
              onClick={undo}
              disabled={!canUndo}
              data-tooltip="Undo last action"
            >
              Undo
            </button>
            <button 
              onClick={redo}
              disabled={!canRedo}
              data-tooltip="Redo last action"
            >
              Redo
            </button>
          </div>
        </div>

        {/* Shape Tools */}
        <div>
          <div className="section-title">Tools</div>
          <div className="button-group">
            <button 
              onClick={() => setMode('select')}
              className={mode === 'select' ? 'active' : ''}
              data-tooltip="Select and modify objects"
            >
              Select
            </button>
            <button 
              onClick={() => {
                setMode('text');
                addText();
              }}
              className={mode === 'text' ? 'active' : ''}
              data-tooltip="Add text label"
            >
              Text
            </button>
            <button 
              onClick={deleteSelected}
              data-tooltip="Delete selected object"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Room Shapes */}
        <div>
          <div className="section-title">Room Shapes</div>
          <div className="button-group">
            <button 
              onClick={() => {
                setMode('rectangle');
                addShape('rectangle');
              }}
              className={mode === 'rectangle' ? 'active' : ''}
              data-tooltip="Add rectangular room"
            >
              Rectangle
            </button>
            <button 
              onClick={() => {
                setMode('triangle');
                addShape('triangle');
              }}
              className={mode === 'triangle' ? 'active' : ''}
              data-tooltip="Add triangular room"
            >
              Triangle
            </button>
            <button 
              onClick={() => {
                setMode('trapezoid');
                addShape('trapezoid');
              }}
              className={mode === 'trapezoid' ? 'active' : ''}
              data-tooltip="Add trapezoid room"
            >
              Trapezoid
            </button>
          </div>
        </div>

        {/* Special Elements */}
        <div>
          <div className="section-title">Special Elements</div>
          <div className="button-group">
            <button 
              onClick={() => {
                setMode('stairs');
                addShape('stairs');
              }}
              className={mode === 'stairs' ? 'active' : ''}
              data-tooltip="Add stairs"
            >
              Stairs
            </button>
            <button 
              onClick={() => {
                setMode('elevator');
                addShape('elevator');
              }}
              className={mode === 'elevator' ? 'active' : ''}
              data-tooltip="Add elevator"
            >
              Elevator
            </button>
            <button 
              onClick={() => {
                setMode('entrance');
                addShape('entrance');
              }}
              className={mode === 'entrance' ? 'active' : ''}
              data-tooltip="Add entrance"
            >
              Entrance
            </button>
            <button 
              onClick={() => {
                setMode('line');
                addShape('line');
              }}
              className={mode === 'line' ? 'active' : ''}
              data-tooltip="Add line"
            >
              Line
            </button>
          </div>
        </div>

        {/* Export Options */}
        <div>
          <div className="section-title">Export</div>
          <div className="button-group">
            <button 
              onClick={exportAsPNG}
              data-tooltip="Export as PNG image"
            >
              PNG
            </button>
            <button 
              onClick={exportAsSVG}
              data-tooltip="Export as SVG image"
            >
              SVG
            </button>
            <button 
              onClick={exportAsJSON}
              data-tooltip="Export as JSON file"
            >
              JSON
            </button>
          </div>
        </div>

        <div className="divider"></div>

        {/* Colors */}
        <div>
          <div className="section-title">Colors</div>
          <div className="color-section">
            <div className="color-input">
              <label>Room Fill</label>
              <input
                type="color"
                value={roomColor}
                onChange={(e) => {
                  setRoomColor(e.target.value);
                  updateSelectedObjectColor(e.target.value);
                }}
                className="color-picker"
                data-tooltip="Change room fill color"
              />
            </div>
            <div className="color-input">
              <label>Room Border</label>
              <input
                type="color"
                value={roomBorderColor}
                onChange={(e) => {
                  setRoomBorderColor(e.target.value);
                  if (fabricCanvasRef.current) {
                    const activeObject = fabricCanvasRef.current.getActiveObject();
                    if (activeObject && activeObject instanceof Rect) {
                      activeObject.set('stroke', e.target.value);
                      fabricCanvasRef.current.renderAll();
                    }
                  }
                }}
                className="color-picker"
                data-tooltip="Change room border color"
              />
            </div>
            <div className="color-input">
              <label>Text Color</label>
              <input
                type="color"
                value={textColor}
                onChange={(e) => {
                  setTextColor(e.target.value);
                  updateSelectedObjectColor(e.target.value);
                }}
                className="color-picker"
                data-tooltip="Change text color"
              />
            </div>
          </div>
        </div>

        <div className="divider"></div>

        {/* Canvas Settings */}
        <div>
          <div className="section-title">Canvas Settings</div>
          <div className="canvas-settings">
            {/* Background Type */}
            <div className="button-group">
              <button 
                onClick={() => setBackgroundType('plain')}
                className={backgroundType === 'plain' ? 'active' : ''}
                data-tooltip="Plain background"
              >
                Plain
              </button>
              <button 
                onClick={() => setBackgroundType('grid')}
                className={backgroundType === 'grid' ? 'active' : ''}
                data-tooltip="Grid background"
              >
                Grid
              </button>
              <button 
                onClick={() => setBackgroundType('lines')}
                className={backgroundType === 'lines' ? 'active' : ''}
                data-tooltip="Lines background"
              >
                Lines
              </button>
            </div>

            {/* Background Color */}
            <div className="color-input">
              <label>Background</label>
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="color-picker"
                data-tooltip="Change canvas background color"
              />
            </div>

            {/* Canvas Size */}
            <div className="size-inputs">
              <div className="size-input">
                <label>Width (px)</label>
                <input
                  type="number"
                  value={canvasSize.width}
                  onChange={(e) => updateCanvasSize(Number(e.target.value), canvasSize.height)}
                  min="200"
                  max="2000"
                  step="50"
                />
              </div>
              <div className="size-input">
                <label>Height (px)</label>
                <input
                  type="number"
                  value={canvasSize.height}
                  onChange={(e) => updateCanvasSize(canvasSize.width, Number(e.target.value))}
                  min="200"
                  max="2000"
                  step="50"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="divider"></div>

        {/* Layer Management */}
        <div>
          <div className="section-title">Layers</div>
          <div className="layers-panel">
            {layers.map(layer => (
              <div key={layer.id} className={`layer-item ${activeLayer === layer.id ? 'active' : ''}`}>
                <button
                  onClick={() => toggleLayerVisibility(layer.id)}
                  className="layer-visibility"
                  data-tooltip={layer.visible ? 'Hide layer' : 'Show layer'}
                >
                  {layer.visible ? '👁️' : '👁️‍🗨️'}
                </button>
                <button
                  onClick={() => toggleLayerLock(layer.id)}
                  className="layer-lock"
                  data-tooltip={layer.locked ? 'Unlock layer' : 'Lock layer'}
                >
                  {layer.locked ? '🔒' : '🔓'}
                </button>
                <span
                  onClick={() => setActiveLayer(layer.id)}
                  className="layer-name"
                >
                  {layer.name}
                </span>
                <button
                  onClick={() => deleteLayer(layer.id)}
                  className="layer-delete"
                  data-tooltip="Delete layer"
                >
                  🗑️
                </button>
              </div>
            ))}
            <button
              onClick={addLayer}
              className="add-layer"
              data-tooltip="Add new layer"
            >
              Add Layer
            </button>
          </div>
        </div>

        <div className="divider"></div>

        {/* Guide Controls */}
        <div>
          <div className="section-title">Guides</div>
          <div className="button-group">
            <button
              onClick={toggleGuides}
              className={showGuides ? 'active' : ''}
              data-tooltip="Toggle guides visibility"
            >
              Guides
            </button>
            <button
              onClick={toggleSnapToGrid}
              className={snapToGrid ? 'active' : ''}
              data-tooltip="Toggle snap to grid"
            >
              Snap to Grid
            </button>
          </div>
          <div className="grid-size-control">
            <label>Grid Size</label>
            <input
              type="number"
              value={gridSize}
              onChange={(e) => updateGridSize(Number(e.target.value))}
              min="5"
              max="100"
              step="5"
            />
          </div>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="canvas-container">
        <div className="canvas-wrapper" style={{ width: canvasSize.width, height: canvasSize.height }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Delete Confirmation</h3>
            <p>Are you sure you want to delete {objectsToDelete.length} objects?</p>
            <div className="modal-buttons">
              <button
                onClick={() => {
                  deleteObjects(objectsToDelete);
                  setShowDeleteConfirm(false);
                  setObjectsToDelete([]);
                }}
                className="delete-confirm"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setObjectsToDelete([]);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
