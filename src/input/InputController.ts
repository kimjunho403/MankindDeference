export class InputController {
  register(
    canvas: HTMLCanvasElement,
    onSelectionComplete?: (rect: { x1: number; y1: number; x2: number; y2: number }) => void,
    onClick?: (clientX: number, clientY: number, button?: number, ctrl?: boolean) => void,
    onDeselect?: () => void,
  ): void {
    this.registerDragSelection(canvas, onSelectionComplete, onClick);
    this.registerEsc(onDeselect);
  }

  private registerDragSelection(
    canvas: HTMLCanvasElement,
    onSelectionComplete?: (rect: { x1: number; y1: number; x2: number; y2: number }) => void,
    onClick?: (clientX: number, clientY: number, button?: number, ctrl?: boolean) => void,
  ): void {
    canvas.style.cursor = 'default';

    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let selecting = false;
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'absolute',
      border: '1px dashed #88ccff',
      background: 'rgba(136,204,255,0.12)',
      pointerEvents: 'none',
      display: 'none',
      zIndex: '1000',
    });
    document.body.appendChild(box);

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDragging = true;
      selecting = false;
      startX = e.clientX;
      startY = e.clientY;
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!selecting && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) selecting = true;
      if (selecting) {
        box.style.display = 'block';
        const left = Math.min(startX, e.clientX);
        const top = Math.min(startY, e.clientY);
        box.style.left   = `${left}px`;
        box.style.top    = `${top}px`;
        box.style.width  = `${Math.abs(e.clientX - startX)}px`;
        box.style.height = `${Math.abs(e.clientY - startY)}px`;
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDragging = false;
      box.style.display = 'none';
      if (selecting) {
        const left   = parseFloat(box.style.left   || '0');
        const top    = parseFloat(box.style.top    || '0');
        const width  = parseFloat(box.style.width  || '0');
        const height = parseFloat(box.style.height || '0');
        if (onSelectionComplete) onSelectionComplete({ x1: left, y1: top, x2: left + width, y2: top + height });
      } else {
        if (onClick) onClick(e.clientX, e.clientY, 0, e.ctrlKey);
      }
    });

    canvas.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      if (onClick) onClick(e.clientX, e.clientY, 2, e.ctrlKey);
    });
  }

  private registerEsc(onDeselect?: () => void): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onDeselect) onDeselect();
    });
  }
}
