import GML from 'gmljs';
import { ASPECT_RATIOS } from './display';

const DEFAULT_DECIMAL_PRECISION = 6;
const DEFAULT_BACKGROUND_COLOR = 'rgba(242, 242, 242, 1)';
const DEFAULT_SCREEN_COLOR = 'rgba(255, 255, 255, 1)';
const DEFAULT_DRAW_COLOR = 'rgba(0, 0, 0, 1)';
const DEFAULT_CANVAS_RATIO = '16:9';

const CANVAS_FILL_SCALE = 0.95;
const CANVAS_BACKGROUND_SETTINGS = {
  fillStyle: DEFAULT_BACKGROUND_COLOR,
  lineWidth: 0,
};
const CANVAS_SCREEN_SETTINGS = {
  fillStyle: DEFAULT_SCREEN_COLOR,
  lineWidth: 0,
};
const CANVAS_DRAW_SETTINGS = {
  fillStyle: DEFAULT_DRAW_COLOR,
  strokeStyle: DEFAULT_DRAW_COLOR,
  lineWidth: 4,
  lineCap: 'round',
};

const GML_WINDOW = ((win) => {
  if (!win.addEventListener) {
    win.addEventListener = () => {};
  }
  if (!win.removeEventListener) {
    win.removeEventListener = () => {};
  }
  return win;
})(window === undefined ? {} : window);

const GML_TIME = (() => (
  typeof performance === 'object' && typeof performance.now  === 'function'
    ? () => performance.now()
    : () => (new Date()).getTime()
))();

const clamp = (value, min = 0, max = 1) =>
  Math.min(Math.max(value, min), max);
const truncate = (value, precision = DEFAULT_DECIMAL_PRECISION) =>
  value.toString().substr(0, 2 + precision);

export default class GMLRecorder {
  constructor(canvas) {
    this.setCanvas(canvas);
    this.recording = false;
    this.brushSize = 4;
    this.aspectRatio = DEFAULT_CANVAS_RATIO;
  }
  setCanvas(canvas) {
    this.canvas = canvas;
    if (this.canvas && this.canvas.getContext) {
      this.canvasContext = this.canvas.getContext('2d');
    }
    else {
      this.canvas = null;
      this.canvasContext = null;
    }
  }
  get _canvas() {
    if (!this.canvas) {
      throw new Error('Canvas not initialized.');
    }
    return this.canvas;
  }
  get _canvasContext() {
    if (!this.canvas || !this.canvas.getContext) {
      throw new Error('Canvas not initialized.');
    }
    return this.canvasContext;
  }
  isRecording() {
    return this.recording;
  }
  setBrushSize(size) {
    if (this.recording) {
      throw new Error('Cannot set brush size while recording.');
    }
    this.brushSize = parseFloat(size);
  }
  setAspectRatio(ratio) {
    if (this.recording) {
      throw new Error('Cannot set aspect ratio while recording.');
    }
    if (!Object.keys(ASPECT_RATIOS).includes(ratio)) {
      throw new Error(`Invalid ratio "${ratio}".`);
    }
    this.aspectRatio = ratio;
    this.update();
  }
  update() {
    this.updateVirtualDimensions();
    this.canvasDrawBackground();
    this.canvasDrawScreenBounds();
  }
  updateVirtualDimensions() {
    if (this.recording) {
      throw new Error('Cannot set dimensions while recordning.');
    }
    let dx = ASPECT_RATIOS[this.aspectRatio].x / this._canvas.width;
    let dy = ASPECT_RATIOS[this.aspectRatio].y / this._canvas.height;
    let s = dx > 1 || dy > 1 || (dx < 1 && dy < 1)
      ? CANVAS_FILL_SCALE / Math.max(dy, dx)
      : 1;
    this.virtualWidth = dx * s * this._canvas.width;
    this.virtualHeight = dy * s * this._canvas.height;
  }
  canvasContextSet(settings) {
    Object.keys(settings).forEach(key => {
      this._canvasContext[key] = settings[key];
    });
  }
  canvasDrawBackground() {
    this.canvasContextSet(CANVAS_BACKGROUND_SETTINGS);
    this._canvasContext.fillRect(0, 0, this._canvas.width, this._canvas.height);
  }
  canvasDrawScreenBounds() {
    this.canvasContextSet(CANVAS_SCREEN_SETTINGS);
    this._canvasContext.fillRect(
      (this._canvas.width - this.virtualWidth) * 0.5,
      (this._canvas.height - this.virtualHeight) * 0.5,
      this.virtualWidth,
      this.virtualHeight
    );
  }
  addPointToStroke(x, y, force = false) {
    if (
      this.lastPoint &&
      this.lastPoint.x == x &&
      this.lastPoint.y == y &&
      !force
    ) {
      return;
    }
    this.canvasContext.beginPath();
    if (this.lastPoint) {
      this.canvasContext.moveTo(this.lastPoint.x, this.lastPoint.y);
    } else {
      this.canvasContext.moveTo(x + 0.000001, y + 0.000001);
    }
    this.canvasContext.lineTo(x, y);
    this.canvasContext.stroke();
    this.lastPoint = { x, y };
    const sx = ((x - (this.canvas.width * 0.5)) / this.virtualWidth) + 0.5;
    const sy = ((y - (this.canvas.height * 0.5)) / this.virtualHeight) + 0.5;
    const st = (GML_TIME() - this.startTime) * 0.001;
    this.currentStroke.push({
      x: parseFloat(truncate(clamp(sx))),
      y: parseFloat(truncate(clamp(sy))),
      z: 0,
      t: parseFloat(truncate(st, 6+Math.floor(Math.log(Math.max(1, st)))))
    });
  }
  beginStroke(x, y) {
    if (this.startTime === null) {
      this.startTime = GML_TIME();
    }
    this.currentStroke = [];
    this.lastPoint = null;
    this.addPointToStroke(x, y);
  }
  endStroke(x, y) {
    while (this.currentStroke.length < 2) {
      x += 0.000001;
      y += 0.000001;
      this.addPointToStroke(x, y, true);
    }
    this.strokes.push(this.currentStroke);
    this.currentStroke = null;
  }
  start() {
    if (this.recording) {
      throw new Error('Recording already in progress.');
    }
    if (!this.canvas || !this.canvasContext) {
      throw new Error('Cannot record without setting target canvas.');
    }
    const onMouseMove = e => {
      this.addPointToStroke(e.clientX, e.clientY);
    };
    const onMouseUp = e => {
      GML_WINDOW.removeEventListener('mouseup', onMouseUp);
      GML_WINDOW.removeEventListener('mousemove', onMouseMove);
      this.endStroke(e.clientX, e.clientY);
    };
    const onMouseDown = e => {
      if (this.canvas == e.target) {
        this.beginStroke(e.clientX, e.clientY);
        GML_WINDOW.addEventListener('mouseup', onMouseUp, false);
        GML_WINDOW.addEventListener('mousemove', onMouseMove, false);
        e.preventDefault();
      }
    };
    this.strokes = [];
    this.startTime = null;
    this.canvasDrawBackground();
    this.canvasDrawScreenBounds();
    this.canvasContextSet(CANVAS_DRAW_SETTINGS);
    this.canvasContextSet({ lineWidth: this.brushSize });
    this.canvasMouseDownHandler = onMouseDown;
    this.canvas.addEventListener('mousedown', this.canvasMouseDownHandler, false);
    this.recording = true;
  }
  stop() {
    this.canvas.removeEventListener('mousedown', this.canvasMouseDownHandler);
    this.canvasMouseDownHandler = null;
    this.currentStroke = null;
    this.startTime = null;
    if (this.strokes.length) {
      const gml = GML.createFromPointArrays(this.strokes);
      return gml;
    }
    return null;
  }
}
