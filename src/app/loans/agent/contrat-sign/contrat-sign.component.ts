import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ContratService } from '../../../services/loans/contrat.service';
import { Router } from '@angular/router';
@Component({
  selector: 'app-contrat-sign',
  templateUrl: './contrat-sign.component.html',
  styleUrls: ['./contrat-sign.component.css']
})
export class ContratSignComponent implements OnInit {

  @ViewChild('canvas', { static: false }) canvas!: ElementRef<HTMLCanvasElement>;

  contrat: any = null;

  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
contratLoaded = false;
  constructor(
  private route: ActivatedRoute,
  private contratService: ContratService,
  private router: Router
) {}
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadContrat(+id);
    }
  }

  
 loadContrat(id: number) {
  this.contratService.getContrat(id).subscribe({
    next: (res: any) => {
      this.contrat = res;
      this.contratLoaded = true;

      setTimeout(() => this.initCanvas(), 200);
    },
    error: (err) => {
      console.error('Error loading contrat:', err);
      this.contratLoaded = false;
    }
  });
}


  initCanvas() {
    const canvasEl = this.canvas?.nativeElement;
    if (!canvasEl) return;

    this.ctx = canvasEl.getContext('2d')!;
    if (!this.ctx) return;

    canvasEl.width = 500;
    canvasEl.height = 200;

    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';

    // IMPORTANT: reset drawing path
    this.ctx.beginPath();

    canvasEl.onmousedown = () => {
      this.drawing = true;
    };

    canvasEl.onmouseup = () => {
      this.drawing = false;
      this.ctx.beginPath();
    };

    canvasEl.onmouseleave = () => {
      this.drawing = false;
      this.ctx.beginPath();
    };

    canvasEl.onmousemove = (event: MouseEvent) => {
      if (!this.drawing) return;

      const rect = canvasEl.getBoundingClientRect();

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      this.ctx.lineTo(x, y);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
    };
  }

  
  clear() {
    const canvasEl = this.canvas?.nativeElement;
    if (!canvasEl) return;

    this.ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    this.ctx.beginPath();
  }

 
 save() {
  const canvasEl = this.canvas?.nativeElement;
  if (!canvasEl) return;

  if (!this.contrat?.contrat?.id) {
    alert("contract not yet loaded");
    return;
  }

  const signatureBase64 = canvasEl.toDataURL('image/png');

  this.contratService.signContrat(
    this.contrat.contrat.id,
    signatureBase64
  ).subscribe({
    next: () => {
      alert('Contrat signed successfully ✔');

      this.contrat.contrat.statutContrat = 'SIGNE';

      setTimeout(() => {
  this.router.navigate(['/']);
}, 800);
    },
    error: (err) => {
      console.error("FULL ERROR:", err.error);
    }
  });
}
  calculateMensualite(montant: number, taux: number, duree: number): number {
  if (!montant || !taux || !duree) return 0;

  const interet = (montant * taux / 100);
  const total = montant + interet;

  return total / duree;
}
}