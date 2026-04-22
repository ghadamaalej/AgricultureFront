import { Component, ElementRef, EventEmitter, AfterViewInit, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-delivery-signature',
  standalone: false,
  templateUrl: './delivery-signature.component.html',
  styleUrls: ['./delivery-signature.component.css']
})
export class DeliverySignatureComponent implements AfterViewInit {
  @ViewChild('signatureCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Output() signatureConfirmed = new EventEmitter<string>();

  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
  isEmpty = true;
  isSaving = false;

  ngAfterViewInit(): void {
    this.initCanvas();
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;
    this.ctx.strokeStyle = '#1a1a2e';
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.drawBackground();
  }

  private drawBackground(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.fillStyle = '#fafafa';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.ctx.strokeStyle = '#d1d5db';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([6, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(20, canvas.height - 36);
    this.ctx.lineTo(canvas.width - 20, canvas.height - 36);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.strokeStyle = '#1a1a2e';
    this.ctx.lineWidth = 2.5;
  }

  onMouseDown(event: MouseEvent): void {
    this.drawing = true;
    const pos = this.getPos(event);
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x, pos.y);
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.drawing) return;
    event.preventDefault();
    const pos = this.getPos(event);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    this.isEmpty = false;
  }

  onMouseUp(): void {
    this.drawing = false;
  }

  onTouchStart(event: TouchEvent): void {
    event.preventDefault();
    const pos = this.getTouchPos(event.touches[0]);
    this.drawing = true;
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x, pos.y);
  }

  onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    if (!this.drawing) return;
    const pos = this.getTouchPos(event.touches[0]);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    this.isEmpty = false;
  }

  onTouchEnd(): void {
    this.drawing = false;
  }

  clearCanvas(): void {
    this.drawBackground();
    this.isEmpty = true;
  }

  confirmSignature(): void {
    if (this.isEmpty || this.isSaving) return;
    this.isSaving = true;
    const dataUrl = this.canvasRef.nativeElement.toDataURL('image/png');
    this.signatureConfirmed.emit(dataUrl);
  }

  resetSaving(): void {
    this.isSaving = false;
  }

  private getPos(event: MouseEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private getTouchPos(touch: Touch): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }
}
