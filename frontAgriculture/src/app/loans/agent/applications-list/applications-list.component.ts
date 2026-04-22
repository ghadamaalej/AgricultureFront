import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { DemandePretService } from '../../../services/loans/demande-pret.service';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PretService } from '../../../services/loans/pret.service';
import { PaimentService } from '../../../services/loans/paiment.service';
import { ContratService } from '../../../services/loans/contrat.service';
import { loadStripe } from '@stripe/stripe-js';
declare const pdfjsLib: any;

@Component({
  selector: 'app-applications-list',
  standalone: false,
  templateUrl: './applications-list.component.html',
  styleUrls: ['./applications-list.component.css']
})
export class ApplicationsListComponent implements OnInit {

  @ViewChild('pdfContainer') pdfContainer!: ElementRef<HTMLDivElement>;

  applications: any[] = [];
  searchText: string = '';
  selectedStatus: string = '';
  documents: string[] = [];
  selectedId!: number;
  selectedFileUrl: any = null;
  selectedFileType: string = '';
  showDocumentsModal = false;
  selectedDocName: string = '';
  totalPages: number = 0;
  zoomLevel: number = 100;
  showRefuseModal = false;
  refuseReason: string = '';
  refuseId!: number;
  scoreFilter: string = '';

  stripe: any;
  elements: any;
  card: any;
  clientSecret!: string;


  pretForm!: FormGroup;
  showPretForm = false;
  selectedApplicationId!: number;
  selectedDateFilter: string = ''; 
  selectedDate: string = ''; 

  currentPage: number = 1;
  itemsPerPage: number = 5;
  private pdfDoc: any = null;
  private renderTasks: any[] = [];

  contrats: Map<number, any> = new Map();

  isProcessing: boolean = false;
  isDevMode: boolean = true; 

  constructor(
    private pretService: PretService,
    private service: DemandePretService,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private fb: FormBuilder,
    private router: Router,
    private paymentService: PaimentService,
    private contratService: ContratService,
  ) {}

  ngOnInit(): void {
    const serviceId = this.route.snapshot.paramMap.get('id');
    if (serviceId) {
      this.loadApplications(+serviceId);
    }
    this.initPretForm();
  }

  initPretForm() {
    this.pretForm = this.fb.group({
      tauxInteret: [null, [Validators.required]],
      dateDebut: [null],
      dateFin: [null],
      montantTotal: [null, [Validators.required]],
      nbEcheances: [null, [Validators.required]],
      agentId: [1],
      statutPret: ['ACTIF']
    });
  }

loadApplications(serviceId: number) {
  this.service.getByService(serviceId).subscribe({
    next: (data: any[]) => {

      this.applications = data;

      this.applications.forEach(app => {

        // INIT STATE SAFE
        app.contratGenere = false;
        app.contratSigne = false;
        app.loanStatus = null;
        app.loanCreated = false;
        app.canCreateLoan = false;

        // CONTRAT
        this.contratService.getContratByDemande(app.id).subscribe({
          next: (contrat: any) => {

            app.contratGenere = !!contrat;
            app.contratSigne = contrat?.statutContrat === 'SIGNE';

            // PRET
            this.pretService.getByDemande(app.id).subscribe({
              next: (pret: any) => {

              
                if (pret) {
                  app.loanStatus = 'ACTIF';
                }

                this.updateLoanState(app);
              },

              error: () => {
                // garder état actuel
                this.updateLoanState(app);
              }
            });

          },
          error: () => {
            app.contratGenere = false;
            app.contratSigne = false;
            this.updateLoanState(app);
          }
        });

      });

    },
    error: err => console.error(err)
  });
}
 acceptAndGenerateContract(app: any) {
  this.contratService.generateContrat(app.id).subscribe({
    next: (contrat: any) => {

      this.contrats.set(app.id, contrat);

      app.contratGenere = true;
      app.contratSigne = false;

      app.loanCreated = false;
      app.canCreateLoan = false;

      alert('Contract generated — waiting for farmer signature');
    },
    error: err => console.error('Error generating contract:', err)
  });
}
  
refreshContratStatus(app: any) {

  this.contratService.getContratByDemande(app.id).subscribe({
    next: (contrat: any) => {

      if (!contrat) return;

      app.contratGenere = true;
      app.contratSigne = contrat.statutContrat === 'SIGNE';

      if (!app.contratSigne) {
        this.updateLoanState(app);
        return;
      }

      this.pretService.getByDemande(app.id).subscribe({
        next: (pret: any) => {

          if (pret) {
            app.loanStatus = 'ACTIF';
          }

          this.updateLoanState(app);
        },
        error: (err) => {
          if (err.status === 404) {
            app.loanStatus = null;
            app.loanCreated = false;
            this.updateLoanState(app);
          } else {
            console.error(err);
          }
        }
      });

    },
    error: err => console.error(err)
  });
}
  
  async openPretForm(appId: number) {

  const app = this.applications.find(a => a.id === appId);
  if (!app) return;

  if (!app.contratGenere || !app.contratSigne) {
    alert("Contrat non signé → prêt impossible");
    return;
  }

  if (app.loanCreated) {
    alert("Prêt déjà créé");
    return;
  }

  this.selectedApplicationId = appId;

  const calc = this.calculateLoanValues(app);
  const dates = this.calculateDates(calc.nbEcheances);

  this.pretForm.patchValue({
    ...calc,
    dateDebut: dates.dateDebut,
    dateFin: dates.dateFin
  });

  this.showPretForm = true;

  setTimeout(() => {
    this.prepareStripe(calc.montantTotal);
  }, 300);
}
  getCurrentAgentId(): number {
    return Number(localStorage.getItem('agentId')) || 1;
  }

  calculateLoanValues(app: any) {
    const montant = app.montantDemande;
    const duree = app.dureeMois;
    const score = app.scoreSolvabilite ?? 0;

    let taux = 0;
    if (score >= 80) taux = 5;
    else if (score >= 50) taux = 8;
    else taux = 12;

    const interet = (montant * taux / 100) * (duree / 12);
    const total = montant + interet;

    return {
      tauxInteret: taux,
      nbEcheances: duree,
      montantTotal: Math.round(total)
    };
  }

  calculateDates(nbMois: number) {
    const today = new Date();
    const dateFin = new Date(today);
    dateFin.setMonth(dateFin.getMonth() + nbMois);
    return {
      dateDebut: this.formatDate(today),
      dateFin: this.formatDate(dateFin)
    };
  }

  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

async payAndCreateLoan() {

  if (this.pretForm.invalid) return;

  const app = this.applications.find(
    a => a.id === this.selectedApplicationId
  );

  if (!app) return;

  // 🔥 IMPORTANT : bloquer si backend dit ACTIF
  if ((app.loanStatus || '').toUpperCase() === 'ACTIF') {
    alert("Loan already active");
    return;
  }

  this.isProcessing = true;

  try {

    const { error, paymentIntent } = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required'
    });

    if (error) {
      this.isProcessing = false;
      alert(error.message);
      return;
    }

    const payload = {
      ...this.pretForm.value,
      demandeId: this.selectedApplicationId,
      paymentIntentId: paymentIntent.id
    };

    this.pretService.createPret(payload).subscribe({

      next: (pret: any) => {

        app.loanStatus = 'ACTIF';
        this.updateLoanState(app);

        this.showPretForm = false;
        this.isProcessing = false;

      },

      error: (err) => {
        console.error(err);
        this.isProcessing = false;
      }
    });

  } catch (e: any) {
    console.error(e);
    alert(e.message);
    this.isProcessing = false;
  }
}
async prepareStripe(amount: number) {
  this.isProcessing = true;

  try {
    // 1. Create PaymentIntent
    const res: any = await this.paymentService
      .createBankIntent(amount)
      .toPromise();

    this.clientSecret = res.clientSecret;

    // 2. Load Stripe
    this.stripe = await loadStripe(
      'pk_test_51QwZ5fH2PLJVXcLszvh95SZ94RJsms2iBGfNcjMJ4kgLvzsmSPy5ctutBdKFQ1tv3h9agpilEnYB76k79JurqGAC00gqIhRu5p'
    );

    if (!this.stripe) return;

    // 3. Create elements AVEC clientSecret
    this.elements = this.stripe.elements({
      clientSecret: this.clientSecret
    });

    
   const paymentElement = this.elements.create('payment', {
  layout: 'tabs'
});


    const container = document.getElementById('card-element');
    if (container) container.innerHTML = '';

    // 6. mount
    paymentElement.mount('#card-element');

  } catch (err) {
    console.error(err);
    alert("Erreur Stripe init");
  } finally {
    this.isProcessing = false;
  }
}
  
  viewDocuments(id: number) {
    this.selectedId = id;
    this.documents = [];
    this.selectedFileUrl = null;
    this.selectedFileType = '';
    this.pdfDoc = null;
    this.zoomLevel = 100;
    this.totalPages = 0;

    this.service.getDocuments(id).subscribe({
      next: (docs: string[]) => {
        this.documents = docs;
        this.showDocumentsModal = true;
      },
      error: (err: any) => console.error('Erreur chargement documents:', err)
    });
  }

  openDocument(filename: string) {
    this.selectedDocName = filename;
    this.cancelAllRenders();
    this.selectedFileUrl = null;
    this.selectedFileType = '';
    this.pdfDoc = null;
    this.zoomLevel = 100;
    this.totalPages = 0;

    setTimeout(() => {
      if (filename.endsWith('.pdf')) {
        this.selectedFileType = 'pdf';
        this.loadPdf(filename);
      } else if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
        this.service.getImageAsObjectUrl(this.selectedId, filename).subscribe({
          next: (objectUrl: string) => {
            this.selectedFileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
            this.selectedFileType = 'image';
          },
          error: (err: any) => console.error('Erreur chargement image:', err)
        });
      } else {
        this.selectedFileType = 'other';
      }
    }, 0);
  }

  loadPdf(filename: string) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    this.service.getPdfAsArrayBuffer(this.selectedId, filename).subscribe({
      next: (buffer: ArrayBuffer) => {
        pdfjsLib.getDocument({ data: buffer }).promise.then((pdf: any) => {
          this.pdfDoc = pdf;
          this.totalPages = pdf.numPages;
          this.renderAllPages();
        });
      },
      error: (err: any) => console.error('Erreur chargement PDF:', err)
    });
  }

  renderAllPages() {
    if (!this.pdfDoc) return;
    this.cancelAllRenders();

    requestAnimationFrame(() => {
      const container = this.pdfContainer?.nativeElement;
      if (!container) {
        setTimeout(() => this.renderAllPages(), 100);
        return;
      }
      container.innerHTML = '';
      for (let pageNum = 1; pageNum <= this.pdfDoc.numPages; pageNum++) {
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'pdf-page-wrapper';
        const canvas = document.createElement('canvas');
        pageWrapper.appendChild(canvas);
        container.appendChild(pageWrapper);
        this.renderSinglePage(pageNum, canvas);
      }
    });
  }

  renderSinglePage(pageNum: number, canvas: HTMLCanvasElement) {
    this.pdfDoc.getPage(pageNum).then((page: any) => {
      const scale = this.zoomLevel / 100;
      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const ctx = canvas.getContext('2d');
      const task = page.render({ canvasContext: ctx, viewport });
      this.renderTasks.push(task);
      task.promise
        .then(() => { this.renderTasks = this.renderTasks.filter(t => t !== task); })
        .catch((err: any) => {
          if (err?.name !== 'RenderingCancelledException') console.error(`Erreur rendu page ${pageNum}:`, err);
          this.renderTasks = this.renderTasks.filter(t => t !== task);
        });
    });
  }

  cancelAllRenders() {
    this.renderTasks.forEach(t => { try { t.cancel(); } catch (_) {} });
    this.renderTasks = [];
  }

  zoomIn() { if (this.zoomLevel < 200) { this.zoomLevel += 20; this.renderAllPages(); } }
  zoomOut() { if (this.zoomLevel > 40) { this.zoomLevel -= 20; this.renderAllPages(); } }

 
  filteredApplications() {
    if (!this.applications) return [];
    const filtered = this.applications.filter(app => {
      const score = app.scoreSolvabilite ?? 0;
      const matchesSearch = !this.searchText ||
        app.farmerName?.toLowerCase().includes(this.searchText.toLowerCase()) ||
        app.montantDemande?.toString().includes(this.searchText) ||
        app.dureeMois?.toString().includes(this.searchText);
      const matchesStatus = !this.selectedStatus || app.statut === this.selectedStatus;
      let matchesScore = true;
      if (this.scoreFilter === 'HIGH') matchesScore = score > 60;
      else if (this.scoreFilter === 'MEDIUM') matchesScore = score >= 40 && score <= 60;
      else if (this.scoreFilter === 'LOW') matchesScore = score < 40;
      return matchesSearch && matchesStatus && matchesScore;
    });
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return filtered.slice(start, start + this.itemsPerPage);
  }

  getTotalPages(): number {
    const len = this.applications.filter(app => {
      const score = app.scoreSolvabilite ?? 0;
      const matchesSearch = !this.searchText ||
        app.farmerName?.toLowerCase().includes(this.searchText.toLowerCase()) ||
        app.montantDemande?.toString().includes(this.searchText) ||
        app.dureeMois?.toString().includes(this.searchText);
      const matchesStatus = !this.selectedStatus || app.statut === this.selectedStatus;
      let matchesScore = true;
      if (this.scoreFilter === 'HIGH') matchesScore = score > 70;
      else if (this.scoreFilter === 'MEDIUM') matchesScore = score >= 50 && score <= 70;
      else if (this.scoreFilter === 'LOW') matchesScore = score < 50;
      return matchesSearch && matchesStatus && matchesScore;
    }).length;
    return Math.ceil(len / this.itemsPerPage);
  }

  getScoreClass(score: number) {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  }

  badgeClass(statut: string): string {
    if (statut === 'APPROUVEE') return 'badge-accepted';
    if (statut === 'REJETEE') return 'badge-rejected';
    return 'badge-pending';
  }

  badgeLabel(statut: string): string {
    if (statut === 'APPROUVEE') return 'Accepted';
    if (statut === 'REJETEE') return 'Refused';
    return 'Pending';
  }

  scoreColor(score: number): string {
    if (score >= 80) return '#2ecc71';
    if (score >= 50) return '#f1c40f';
    return '#e74c3c';
  }

 
  openRefuseModal(id: number) {
    this.refuseId = id;
    this.refuseReason = '';
    this.showRefuseModal = true;
  }

  confirmRefuse() {
    if (!this.refuseReason.trim()) { alert('Please enter a reason'); return; }
    this.service.refuseDemande(this.refuseId, this.refuseReason).subscribe({
      next: () => {
        const app = this.applications.find(a => a.id === this.refuseId);
        if (app) { app.statut = 'REJETEE'; app.decision = 'REJETEE'; }
        this.showRefuseModal = false;
      },
      error: err => console.error(err)
    });
  }

  calculateScore(id: number) {
    this.service.calculateScore(id).subscribe({
      next: (res: any) => {
        const app = this.applications.find(a => a.id === id);
        if (app) { app.score = res.score; app.decision = res.decision; }
      },
      error: (err) => console.error('Erreur score:', err)
    });
  }

updateLoanState(app: any) {

  const status = (app.loanStatus ?? '').toString().toUpperCase();

  const isActive = status === 'ACTIF';

  app.loanCreated = isActive;

  app.canCreateLoan =
    app.contratGenere === true &&
    app.contratSigne === true &&
    isActive === false &&
    app.statut !== 'REJETEE';
}

}