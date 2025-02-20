import React, { useEffect, useRef, useState } from 'react';
import { Canvas, IText, Rect, Pattern, Polygon, Line, Path, Object as FabricObject, InteractiveFabricObject, Point, Group } from 'fabric';
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

  interface Object {
    areaLabel?: any;
    squareMeters?: number;
    roomType?: string;
    on(eventName: string, handler: Function): void;
  }
}

type BackgroundType = 'plain' | 'grid' | 'lines';
type ShapeType = 'rectangle' | 'triangle' | 'trapezoid' | 'line' | 'stairs' | 'elevator' | 'entrance';

interface CanvasScale {
  totalSquareMeters: number;
  pixelsPerMeter: number;
}

interface RoomType {
  name: string;
  minArea: number;
  maxArea: number;
  recommendedArea: number;
}

const roomTypes: { [key: string]: RoomType } = {
  livingRoom: {
    name: 'Living Room',
    minArea: 20,
    maxArea: 50,
    recommendedArea: 30
  },
  bedroom: {
    name: 'Bedroom',
    minArea: 12,
    maxArea: 30,
    recommendedArea: 16
  },
  kitchen: {
    name: 'Kitchen',
    minArea: 8,
    maxArea: 25,
    recommendedArea: 15
  },
  bathroom: {
    name: 'Bathroom',
    minArea: 4,
    maxArea: 12,
    recommendedArea: 6
  },
  diningRoom: {
    name: 'Dining Room',
    minArea: 10,
    maxArea: 30,
    recommendedArea: 20
  }
};

type ExtendedFabricObject = FabricObject & {
  areaLabel?: IText;
  squareMeters?: number;
  roomType?: string;
  on(eventName: string, handler: Function): void;
};

interface RoomProperties extends FabricObject {
  roomType?: string;
  areaLabel?: any;
  squareMeters?: number;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const [mode, setMode] = useState<'select' | ShapeType | 'text'>('select');
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('grid');
  const [backgroundColor, setBackgroundColor] = useState('#f0f0f0');
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 1000 });
  const [canvasScale, setCanvasScale] = useState<CanvasScale>({
    totalSquareMeters: 100, // Default 100m²
    pixelsPerMeter: 50 // Default 50px = 1m
  });
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
  const [gridSize, setGridSize] = useState(50); // 1 grid = 1m²
  const [pixelToMeter, setPixelToMeter] = useState(1); // 1 pixel = 1m²
  const guidesRef = useRef<FabricObject[]>([]);
  const [selectedRoomType, setSelectedRoomType] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(0.5); // Başlangıçta daha geniş görüntü
  const minZoom = 0.1;
  const maxZoom = 10; // Daha fazla zoom yapılabilsin

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
      // Canvas boyutlarını güncelle
      fabricCanvasRef.current.setWidth(width);
      fabricCanvasRef.current.setHeight(height);
      setCanvasSize({ width, height });

      // Yeni toplam alan hesapla (m²)
      const newTotalArea = calculateSquareMeters(width, height);
      setCanvasScale(prev => ({
        ...prev,
        totalSquareMeters: newTotalArea
      }));

      // Tüm nesnelerin alanlarını güncelle
      fabricCanvasRef.current.getObjects().forEach(obj => {
        if ((obj instanceof Rect || obj instanceof Polygon) && !obj.get('absolutePositioned')) {
          const area = calculateSquareMeters(
            obj.width! * obj.scaleX!,
            obj.height! * obj.scaleY!
          );
          
          // Alan etiketini güncelle
          if ((obj as RoomProperties).areaLabel) {
            const roomTypeText = (obj as RoomProperties).roomType ? 
              ` (${roomTypes[(obj as RoomProperties).roomType!].name})` : '';
            (obj as RoomProperties).areaLabel.set({
              text: `${area.toFixed(2)}m²${roomTypeText}`
            });
          }
        }
      });

      createGridPattern(fabricCanvasRef.current, backgroundType);
      createGuides(fabricCanvasRef.current);
      fabricCanvasRef.current.renderAll();
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

  const addAreaLabel = (object: RoomProperties, area: number) => {
    if (!(object instanceof Rect || object instanceof Polygon)) return;
    
    const label = new IText(`${area}m²`, {
      left: object.left! + (object.width! * object.scaleX!) / 2,
      top: object.top! + (object.height! * object.scaleY!) / 2,
      fontSize: 14,
      fill: '#333333',
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      padding: 5
    }) as unknown as FabricObject;

    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.add(label);
      object.areaLabel = label;
      
      const updateLabelPosition = () => {
        if (label && object) {
          const area = calculateSquareMeters(
            object.width! * object.scaleX!,
            object.height! * object.scaleY!
          );
          const roomTypeText = object.roomType ? 
            ` (${roomTypes[object.roomType].name})` : '';
          
          (label as any).set({
            left: object.left! + (object.width! * object.scaleX!) / 2,
            top: object.top! + (object.height! * object.scaleY!) / 2,
            text: `${area}m²${roomTypeText}`
          });
          fabricCanvasRef.current?.renderAll();
        }
      };

      object.on('moving', updateLabelPosition);
      object.on('scaling', updateLabelPosition);
    }
  };

  const addShape = (shapeType: string, defaultSquareMeters: number = 20) => {
    if (!fabricCanvasRef.current) return;

    if (defaultSquareMeters > canvasScale.totalSquareMeters) {
        alert(`Default room area (${defaultSquareMeters}m²) cannot be larger than total area (${canvasScale.totalSquareMeters}m²)`);
        return;
    }

    // Grid boyutuna göre piksel hesapla
    const sideLength = Math.sqrt(defaultSquareMeters) * gridSize;
    
    let shape: RoomProperties;
    const commonProps = {
        left: 50,
        top: 50,
        fill: 'rgba(0, 0, 255, 0.3)',
        stroke: 'blue',
        strokeWidth: 2,
        selectable: true,
        hasControls: true
    };

    if (shapeType === 'rectangle') {
        shape = new Rect({
            ...commonProps,
            width: sideLength,
            height: sideLength
        });
    } else if (shapeType === 'triangle') {
        const points = [
            { x: 0, y: sideLength },           // Alt orta nokta
            { x: -sideLength/2, y: 0 },        // Sol üst nokta
            { x: sideLength/2, y: 0 }          // Sağ üst nokta
        ];
        shape = new Polygon(points, {
            ...commonProps
        });
    } else if (shapeType === 'trapezoid') {
        const topWidth = sideLength * 0.6;     // Üst kenar genişliği alt kenarın %60'ı
        const points = [
            { x: -sideLength/2, y: sideLength },    // Sol alt nokta
            { x: sideLength/2, y: sideLength },     // Sağ alt nokta
            { x: topWidth/2, y: 0 },                // Sağ üst nokta
            { x: -topWidth/2, y: 0 }                // Sol üst nokta
        ];
        shape = new Polygon(points, {
            ...commonProps
        });
    } else if (shapeType === 'stairs') {
        // Merdiven şekli - basamaklar
        const stepCount = 6; // Basamak sayısı
        const stepWidth = sideLength;
        const stepHeight = sideLength / stepCount;
        const points = [];
        
        // Basamakları oluştur
        for (let i = 0; i < stepCount; i++) {
            points.push({ x: -stepWidth/2, y: i * stepHeight }); // Sol nokta
            points.push({ x: -stepWidth/2 + (stepWidth/stepCount) * (i+1), y: i * stepHeight }); // Üst nokta
            points.push({ x: -stepWidth/2 + (stepWidth/stepCount) * (i+1), y: (i+1) * stepHeight }); // Alt nokta
        }
        
        shape = new Polygon(points, {
            ...commonProps,
            fill: 'rgba(128, 128, 128, 0.5)',
            stroke: '#666666'
        });
    } else if (shapeType === 'elevator') {
        // Asansör şekli - Mimari standartlara uygun
        const elevatorWidth = sideLength * 0.8;
        const elevatorHeight = sideLength;
        const doorWidth = elevatorWidth * 0.8;
        
        // Ana dikdörtgen (asansör kabini)
        const mainRect = new Rect({
            ...commonProps,
            width: elevatorWidth,
            height: elevatorHeight,
            fill: 'rgba(240, 240, 240, 0.5)',
            stroke: '#666666'
        });
        
        // Asansör kapısı çizgileri
        const doorLeft = new Line([
            -doorWidth/2, -elevatorHeight/2,
            -doorWidth/2, elevatorHeight/2
        ], {
            stroke: '#666666',
            strokeWidth: 2,
            selectable: false
        });
        
        const doorRight = new Line([
            doorWidth/2, -elevatorHeight/2,
            doorWidth/2, elevatorHeight/2
        ], {
            stroke: '#666666',
            strokeWidth: 2,
            selectable: false
        });
        
        // Asansör sembolü (küçük kare)
        const symbolSize = elevatorWidth * 0.2;
        const symbol = new Rect({
            width: symbolSize,
            height: symbolSize,
            left: -symbolSize/2,
            top: -elevatorHeight/4,
            fill: '#666666',
            selectable: false
        });

        // Tüm elemanları bir grup olarak birleştir
        shape = new Group([mainRect, doorLeft, doorRight, symbol], {
            left: 50,
            top: 50
        }) as unknown as RoomProperties;
    } else if (shapeType === 'entrance') {
        // Giriş şekli - yarım daire
        const radius = sideLength / 2;
        const points = [];
        const steps = 32;
        
        // Yarım daire noktaları
        for (let i = 0; i <= steps; i++) {
            const angle = (Math.PI * i) / steps;
            points.push({
                x: radius * Math.cos(angle),
                y: radius * Math.sin(angle)
            });
        }
        
        // Taban çizgisi
        points.push({ x: radius, y: 0 });
        points.push({ x: -radius, y: 0 });
        
        shape = new Polygon(points, {
            ...commonProps,
            fill: 'rgba(144, 238, 144, 0.5)',
            stroke: '#4CAF50'
        });
    } else if (shapeType === 'line') {
        // Basit çizgi
        shape = new Line([
            -sideLength/2, 0,
            sideLength/2, 0
        ], {
            stroke: roomBorderColor,
            strokeWidth: 2,
            selectable: true,
            hasControls: true
        }) as unknown as RoomProperties;
    } else {
        return;
    }

    if (!shape) return;

    fabricCanvasRef.current.add(shape);
    addAreaLabel(shape, defaultSquareMeters);
    fabricCanvasRef.current.requestRenderAll();
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
      objects.forEach(obj => {
        canvas.remove(obj);
        // Remove associated area label
        if ((obj as any).areaLabel) {
          canvas.remove((obj as any).areaLabel);
        }
      });
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
      }) as unknown as FabricObject;

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
    
    // Grid boyutunu değiştirdiğimizde canvas boyutunu da güncelle
    const sideLengthInMeters = Math.ceil(Math.sqrt(canvasScale.totalSquareMeters));
    const newSize = sideLengthInMeters * size;
    
    if (fabricCanvasRef.current) {
      updateCanvasSize(newSize, newSize);
      createGridPattern(fabricCanvasRef.current, backgroundType);
      createGuides(fabricCanvasRef.current);
    }
  };

  // Square meter calculations
  const calculateSquareMeters = (width: number, height: number): number => {
    // Grid boyutuna göre metre cinsinden alanı hesapla
    const metersWidth = width / gridSize;
    const metersHeight = height / gridSize;
    return Number((metersWidth * metersHeight).toFixed(2));
  };

  const updateCanvasScale = (totalSquareMeters: number) => {
    // Toplam alana göre bir kenarın metre cinsinden uzunluğunu hesapla
    const sideLengthInMeters = Math.ceil(Math.sqrt(totalSquareMeters));
    
    // Grid boyutuna göre canvas boyutunu hesapla (her metre için 50 piksel)
    const newSize = sideLengthInMeters * gridSize;

    // Canvas boyutlarını güncelle
    if (fabricCanvasRef.current) {
      updateCanvasSize(newSize, newSize);
    }

    setCanvasScale({
      totalSquareMeters,
      pixelsPerMeter: gridSize
    });

    // Mevcut nesnelerin ölçeklerini güncelle
    if (fabricCanvasRef.current) {
      const canvas = fabricCanvasRef.current;
      canvas.getObjects().forEach(obj => {
        if (obj instanceof Rect || obj instanceof Polygon) {
          const currentArea = calculateSquareMeters(obj.width! * obj.scaleX!, obj.height! * obj.scaleY!);
          if (currentArea > totalSquareMeters) {
            const newArea = totalSquareMeters * 0.25;
            const scaleFactor = Math.sqrt(newArea / currentArea);
            obj.set({
              scaleX: obj.scaleX! * scaleFactor,
              scaleY: obj.scaleY! * scaleFactor
            });
            
            if (obj.areaLabel && obj.areaLabel instanceof IText) {
              const roomTypeText = (obj as RoomProperties).roomType ? 
                ` (${roomTypes[(obj as RoomProperties).roomType!].name})` : '';
              obj.areaLabel.set({
                text: `${newArea.toFixed(2)}m²${roomTypeText}`
              });
            }
          }
        }
      });
      canvas.renderAll();
    }
  };

  const updateShapeSquareMeters = (object: RoomProperties, targetSquareMeters: number) => {
    if (targetSquareMeters > canvasScale.totalSquareMeters) {
        alert(`Room area (${targetSquareMeters}m²) cannot be larger than total area (${canvasScale.totalSquareMeters}m²)`);
        return;
    }

    // Grid boyutuna göre piksel hesapla
    const currentArea = calculateSquareMeters(object.width!, object.height!);
    const scaleFactor = Math.sqrt(targetSquareMeters / currentArea);
    
    const newWidth = object.width! * scaleFactor;
    const newHeight = object.height! * scaleFactor;
    
    // Yeni boyutları piksel cinsinden ayarla
    object.set({
        width: newWidth,
        height: newHeight,
        scaleX: 1,
        scaleY: 1
    });
    
    // Alan etiketini güncelle
    const label = fabricCanvasRef.current?.getObjects().find(obj => obj.areaLabel && obj.areaLabel === object) as IText;
    if (label) {
        const roomType = object.roomType ? ` (${object.roomType})` : '';
        label.set('text', `${targetSquareMeters}m²${roomType}`);
        updateLabelPosition(label, object);
    }
    
    fabricCanvasRef.current?.requestRenderAll();
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

  // Area calculation and reporting
  const calculateTotalArea = (): { totalArea: number; roomAreas: { name: string; area: number }[] } => {
    const result = {
      totalArea: 0,
      roomAreas: [] as { name: string; area: number }[]
    };

    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.getObjects().forEach(obj => {
        if ((obj instanceof Rect || obj instanceof Polygon) && !obj.get('areaLabel')) {
          const area = calculateSquareMeters(
            obj.width! * obj.scaleX!,
            obj.height! * obj.scaleY!
          );
          result.totalArea += area;
          result.roomAreas.push({
            name: obj.areaLabel?.text || 'Unnamed Room',
            area
          });
        }
      });
    }

    return result;
  };

  const generateAreaReport = () => {
    const { totalArea, roomAreas } = calculateTotalArea();
    
    const reportContent = `
Floor Plan Area Report
---------------------
Total Area: ${totalArea.toFixed(2)}m²

Room Details:
${roomAreas.map(room => `${room.name}: ${room.area.toFixed(2)}m²`).join('\n')}

Remaining Area: ${(canvasScale.totalSquareMeters - totalArea).toFixed(2)}m²
    `.trim();

    // Create and trigger download
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'floor-plan-report.txt';
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const updateLabelPosition = (label: IText, object: RoomProperties) => {
    label.set({
        left: object.left! + object.width! / 2,
        top: object.top! + object.height! / 2
    });
  };

  // İlk yüklemede canvas boyutunu ayarla
  useEffect(() => {
    const sideLengthInMeters = Math.ceil(Math.sqrt(canvasScale.totalSquareMeters));
    const newSize = sideLengthInMeters * gridSize;
    updateCanvasSize(newSize, newSize);
  }, []);

  // Zoom fonksiyonları
  const handleZoomIn = () => {
    if (fabricCanvasRef.current && zoomLevel < maxZoom) {
      const newZoom = Math.min(zoomLevel * 1.2, maxZoom); // Daha hassas zoom
      const canvas = fabricCanvasRef.current;
      const center = canvas.getCenter();
      
      const point = new Point(center.left, center.top);
      canvas.zoomToPoint(point, newZoom);
      setZoomLevel(newZoom);
      
      updateGridAndGuides();
    }
  };

  const handleZoomOut = () => {
    if (fabricCanvasRef.current && zoomLevel > minZoom) {
      const newZoom = Math.max(zoomLevel / 1.2, minZoom); // Daha hassas zoom
      const canvas = fabricCanvasRef.current;
      const center = canvas.getCenter();
      
      const point = new Point(center.left, center.top);
      canvas.zoomToPoint(point, newZoom);
      setZoomLevel(newZoom);
      
      updateGridAndGuides();
    }
  };

  const handleZoomReset = () => {
    if (fabricCanvasRef.current) {
      const canvas = fabricCanvasRef.current;
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      setZoomLevel(1);
      
      updateGridAndGuides();
    }
  };

  // Mouse wheel ile zoom
  const handleMouseWheel = (e: WheelEvent) => {
    if (fabricCanvasRef.current && e.ctrlKey) {
      e.preventDefault();
      const canvas = fabricCanvasRef.current;
      const delta = e.deltaY;
      let newZoom = zoomLevel;

      if (delta < 0) {
        newZoom = Math.min(zoomLevel * 1.1, maxZoom);
      } else {
        newZoom = Math.max(zoomLevel / 1.1, minZoom);
      }

      const pointer = canvas.getPointer(e);
      const point = new Point(pointer.x, pointer.y);
      canvas.zoomToPoint(point, newZoom);
      setZoomLevel(newZoom);
      
      updateGridAndGuides();
    }
  };

  // Grid ve kılavuzları güncelle
  const updateGridAndGuides = () => {
    if (fabricCanvasRef.current) {
      const canvas = fabricCanvasRef.current;
      createGridPattern(canvas, backgroundType);
      createGuides(canvas);
    }
  };

  // Pan özelliği için mouse event'leri
  useEffect(() => {
    if (fabricCanvasRef.current) {
      const canvas = fabricCanvasRef.current;
      let isDragging = false;
      let lastPosX = 0;
      let lastPosY = 0;

      canvas.on('mouse:down', (opt) => {
        const evt = opt.e as MouseEvent;
        if (evt.altKey) {
          isDragging = true;
          canvas.selection = false;
          lastPosX = evt.clientX;
          lastPosY = evt.clientY;
        }
      });

      canvas.on('mouse:move', (opt) => {
        if (isDragging) {
          const evt = opt.e as MouseEvent;
          const vpt = canvas.viewportTransform!;
          vpt[4] += evt.clientX - lastPosX;
          vpt[5] += evt.clientY - lastPosY;
          canvas.requestRenderAll();
          lastPosX = evt.clientX;
          lastPosY = evt.clientY;
        }
      });

      canvas.on('mouse:up', () => {
        isDragging = false;
        canvas.selection = true;
      });

      // Mouse wheel event listener'ı ekle
      const canvasElement = canvas.getElement();
      canvasElement.addEventListener('wheel', handleMouseWheel, { passive: false });

      return () => {
        canvasElement.removeEventListener('wheel', handleMouseWheel);
      };
    }
  }, [zoomLevel]);

  // Canvas container stilini güncelleyelim
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
            <button 
              onClick={generateAreaReport}
              data-tooltip="Generate area report"
            >
              Report
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
            {/* Total Square Meters Input */}
            <div className="size-input">
              <label>Total Area (m²)</label>
              <input
                type="number"
                value={canvasScale.totalSquareMeters}
                onChange={(e) => updateCanvasScale(Number(e.target.value))}
                min="10"
                max="1000"
                step="10"
                data-tooltip="Set total canvas area in square meters"
              />
            </div>

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

        {/* Zoom Controls - Canvas Settings altına ekleyelim */}
        <div>
          <div className="section-title">Zoom Controls</div>
          <div className="button-group">
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= maxZoom}
              data-tooltip="Zoom In"
            >
              Zoom In
            </button>
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= minZoom}
              data-tooltip="Zoom Out"
            >
              Zoom Out
            </button>
            <button
              onClick={handleZoomReset}
              data-tooltip="Reset Zoom"
            >
              Reset (100%)
            </button>
          </div>
          <div className="zoom-level">
            Zoom: {(zoomLevel * 100).toFixed(0)}%
          </div>
        </div>

        {/* Add Square Meter Display for Selected Object */}
        {fabricCanvasRef.current?.getActiveObject() && 
         (fabricCanvasRef.current.getActiveObject() instanceof Rect || 
          fabricCanvasRef.current.getActiveObject() instanceof Polygon) && (
          <div className="object-properties">
            <div className="section-title">Selected Room</div>
            <div className="size-input">
              <label>Area (m²)</label>
              <input
                type="number"
                value={(() => {
                  const activeObject = fabricCanvasRef.current?.getActiveObject() as RoomProperties;
                  if (!activeObject) return 0;
                  return calculateSquareMeters(
                    activeObject.width! * activeObject.scaleX!,
                    activeObject.height! * activeObject.scaleY!
                  );
                })()}
                onChange={(e) => {
                  const activeObject = fabricCanvasRef.current?.getActiveObject() as RoomProperties;
                  if (activeObject) {
                    const newArea = Number(e.target.value);
                    updateShapeSquareMeters(activeObject, newArea);
                    if (activeObject.areaLabel) {
                      const roomTypeText = activeObject.roomType ? 
                        ` (${roomTypes[activeObject.roomType].name})` : '';
                      activeObject.areaLabel.set({
                        text: `${newArea}m²${roomTypeText}`
                      });
                      fabricCanvasRef.current?.renderAll();
                    }
                  }
                }}
                min="1"
                max={canvasScale.totalSquareMeters}
                step="0.5"
                data-tooltip="Set room area in square meters"
              />
            </div>
          </div>
        )}

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
            <label>Grid Size (1 square = {pixelToMeter.toFixed(2)}m²)</label>
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

        {/* Room Type Selector */}
        <div>
          <div className="section-title">Room Type</div>
          <select
            value={selectedRoomType}
            onChange={(e) => setSelectedRoomType(e.target.value)}
            className="room-type-select"
            data-tooltip="Select room type for area constraints"
          >
            <option value="">Custom Room</option>
            {Object.entries(roomTypes).map(([key, type]) => (
              <option key={key} value={key}>
                {type.name} ({type.recommendedArea}m²)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="canvas-container">
        <div 
          className="canvas-wrapper" 
          style={{ 
            width: '100%',
            height: 'calc(100vh - 32px)',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
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
