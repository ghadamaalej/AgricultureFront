import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Pret } from '../../models/pret';
import { Echeance, StatutEcheance } from '../../models/echeance';
import { Demande, StatutDemande } from '../../models/demande';
import { AuthService } from '../../../services/auth/auth.service';
import { PretService } from 'src/app/services/loans/pret.service';
import { EcheanceService } from 'src/app/services/loans/echeance.service';
import { DemandePretService } from 'src/app/services/loans/demande-pret.service';
import { PaimentService } from 'src/app/services/loans/paiment.service';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { ViewChild, ElementRef } from '@angular/core';
export interface Farmer {
  prenom: string;
  nom: string;
  scoreSolvabilite: number;
}

@Component({
  selector: 'app-agri-dashboard',
  standalone: false,
  templateUrl: './agri-dashboard.component.html',
  styleUrls: ['./agri-dashboard.component.css']
})
export class AgriDashboardComponent implements OnInit {

  farmer: Farmer | null = null;
  today = new Date();

  prets: Pret[] = [];
  echeances: Echeance[] = [];
  recentDemandes: Demande[] = [];

  selectedPretId: number | null = null;
  selectedPret: Pret | null = null;
  selectedEcheances: Echeance[] = [];

  stripe: Stripe | null = null;
  card: any;
  elements: any;

  showAllDemandes = false;
demandes: Demande[] = [];

  kpis: any[] = [];
 
stripeReady = false;

    showAllPrets = false;

    echeancesByPret: { [pretId: number]: Echeance[] } = {};

    currentNextEcheanceId: number | null = null;
    @ViewChild('cardElement') cardElement!: ElementRef;

  constructor(
  private router: Router,
  public authService: AuthService,
  private pretService: PretService,
  private echeanceService: EcheanceService,
  private demandeService: DemandePretService,
  private paiementService: PaimentService 
) {}

async ngOnInit() {
  this.stripe = await loadStripe('pk_test_51QwZ5fH2PLJVXcLszvh95SZ94RJsms2iBGfNcjMJ4kgLvzsmSPy5ctutBdKFQ1tv3h9agpilEnYB76k79JurqGAC00gqIhRu5p');

  this.loadPrets();
  this.loadDemandes();
  this.buildKpis();

  this.elements = this.stripe!.elements();
  this.card = this.elements.create('card');

  this.stripeReady = true;

}
ngAfterViewChecked(): void {
  this.mountStripeIfNeeded();
}

goToInstitutions(): void {
  this.router.navigate(['/loans/institutions']);
}

mountStripeIfNeeded(): void {
  const next = this.getNextPayableEcheance();

  if (!next || !this.card || !this.cardElement) return;

  if (this.currentNextEcheanceId === next.id) return;

this.currentNextEcheanceId = next.id ?? null;
  setTimeout(() => {
    try {
      this.card.unmount?.();
    } catch {}

    this.card.mount(this.cardElement.nativeElement);
  });
}

 getPrenom(): string | null {
  const user = this.authService.getCurrentUser()
  return user?.username?.split(' ')[0] ?? null;
}

get displayedPrets(): Pret[] {
  const list = this.getActivePrets();
  return this.showAllPrets ? list : list.slice(0, 3);
}

toggleShowAll(): void {
  this.showAllPrets = !this.showAllPrets;
}

  loadPrets(): void {
  const user = this.authService.getCurrentUser();

  if (!user) return;

  this.pretService.getPretsByAgriculteur(user.userId)
  .subscribe({
    next: (data) => {
      this.prets = data;

      this.prets.forEach(p => {
        if (!p.id) return;

        this.echeanceService.getEcheancesByPret(p.id).subscribe(echs => {
          this.echeancesByPret[p.id!] = echs;
        });
      });

      if (this.prets.length > 0) {
        this.selectPret(this.prets[0]);
      }
    }
  });
}

get displayedDemandes(): Demande[] {
  return this.showAllDemandes ? this.demandes : this.demandes.slice(0, 3);
}

toggleShowAllDemandes(): void {
  this.showAllDemandes = !this.showAllDemandes;
}
  

  loadDemandes(): void {
  const user = this.authService.getCurrentUser();
  if (!user) return;

  this.demandeService.getDemandesByAgriculteur(user.userId)
    .subscribe({
      next: (data) => {
        this.demandes = data;
      },
      error: (err) => console.error(err)
    });
}


  buildKpis(): void {
    const overdue = this.getOverdueEcheances().length;
    this.kpis = [
      {
        icon: '📊', val: this.farmer?.scoreSolvabilite || 0,
        label: 'Score solvabilité', badge: this.getScoreLabel(),
        badgeClass: (this.farmer?.scoreSolvabilite || 0) >= 70 ? 'badge-green' : 'badge-amber'
      },
      {
        icon: '📋', val: this.recentDemandes.length,
        label: 'Demandes',
        badge: `${this.recentDemandes.filter(d => d.statut === 'EN_ATTENTE').length} Pending`,
        badgeClass: 'badge-amber'
      },
      {
        icon: '💰', val: this.getActivePrets().length,
        label: 'Prêts actifs',
        badge: `${this.getActivePrets().reduce((s, p) => s + p.montantTotal, 0).toLocaleString()} DT`,
        badgeClass: 'badge-green'
      },
      {
        icon: '⚠️', val: overdue,
        label: 'Échéances en retard',
        badge: overdue > 0 ? 'Urgent' : 'OK',
        badgeClass: overdue > 0 ? 'badge-red' : 'badge-green'
      }
    ];
  }

selectPret(pret: Pret): void {
  this.selectedPretId = pret.id ?? null;
  this.selectedPret = pret;

  if (!pret.id) return;

  this.echeanceService.getEcheancesByPret(pret.id).subscribe({
    next: (data) => {
      this.selectedEcheances = data;
      this.buildKpis();
    }
  });
}


  getInitials(): string {
    if (!this.farmer) return '?';
    return (this.farmer.prenom[0] + this.farmer.nom[0]).toUpperCase();
  }

  getScoreLabel(): string {
    const score = this.farmer?.scoreSolvabilite || 0;
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Bon profil';
    if (score >= 40) return 'Moyen';
    return 'Faible';
  }

  getScoreOffset(): number {
    const circumference = 326.73;
    const score = this.farmer?.scoreSolvabilite || 0;
    return circumference - (score / 100) * circumference;
  }

  getActivePrets(): Pret[] {
    return this.prets.filter(p =>
      p.statutPret === 'ACTIF' || p.statutPret === 'EN_RETARD'
    );
  }

getPretProgress(pret: Pret): number {
  if (!pret.id) return 0;

  const echeances = this.echeancesByPret[pret.id] || [];

  const paid = echeances
    .filter((e: Echeance) => e.statut === 'PAYEE')
    .reduce((sum: number, e: Echeance) => sum + e.montant, 0);

  return pret.montantTotal > 0
    ? (paid / pret.montantTotal) * 100
    : 0;
}

  getProgressColor(pret: Pret): string {
    const pct = this.getPretProgress(pret);
    if (pct >= 66) return '#3ddc84';
    if (pct >= 33) return '#f5a623';
    return '#f0503a';
  }

  getPretRef(pret: Pret): string {
    return `PRE-${String(pret.id ?? 0).padStart(3, '0')}`;
  }

  getPretLabel(pret: Pret): string {
    return `${pret.tauxInteret}%/an — ${pret.nbEcheances} mois`;
  }

getProchaineEcheance(pret: Pret): Echeance | null {
  return this.selectedEcheances
    .filter((e: Echeance) => e.statut === 'EN_ATTENTE')
    .sort((a: Echeance, b: Echeance) =>
      a.dateDebut.localeCompare(b.dateDebut)
    )[0] ?? null;
}
 
  getOverdueEcheances(): Echeance[] {
  return this.selectedEcheances.filter(
    e => e.statut === 'EN_RETARD'
  );
}

  hasAlerts(): boolean {
    return this.getOverdueEcheances().length > 0;
  }

  
  getPaidCount(): number {
  return this.selectedEcheances.filter(e => e.statut === 'PAYEE').length;
}

getPendingCount(): number {
  return this.selectedEcheances.filter(e => e.statut === 'EN_ATTENTE').length;
}

getOverdueCount(): number {
  return this.selectedEcheances.filter(e => e.statut === 'EN_RETARD').length;
}

getRemainingAmount(): number {
  return this.selectedEcheances
    .filter(e => e.statut !== 'PAYEE')
    .reduce((sum, e) => sum + e.montant, 0);
}


  getBadgeClass(statut: StatutDemande): string {
    if (statut === 'APPROUVEE')      return 'badge-approuve';
    if (statut === 'REJETEE')  return 'badge-rejete';
    return 'badge-attente';
  }

  getBadgeLabel(statut: StatutDemande): string {
    if (statut === 'APPROUVEE')      return '● Accepeted';
    if (statut === 'REJETEE')  return '●  Rejected';
    return '● Pending';
  }

  
  getEchRowClass(e: Echeance): string {
    if (e.statut === ('EN_RETARD' as StatutEcheance))   return 'row-overdue';
    if (e.statut === ('PAYEE' as StatutEcheance)) return 'row-paid';
    return '';
  }

  getEchBadgeClass(statut: StatutEcheance): string {
  if (statut === 'PAYEE') return 'ech-badge ech-payee';
  if (statut === 'EN_RETARD') return 'ech-badge ech-retard';
  return 'ech-badge ech-attente';
}

getEchBadgeLabel(statut: StatutEcheance): string {
  if (statut === 'PAYEE') return '● Paid';
  if (statut === 'EN_RETARD') return '● overdue';
  return '● En attente';
}

  scrollToEcheancier(): void {
    document.getElementById('echeancier-section')
      ?.scrollIntoView({ behavior: 'smooth' });
  }

  
  goToDemandes(): void     { this.router.navigate(['/mes-demandes']); }
  downloadReleve(): void   { alert('Téléchargement du relevé en cours...'); }

 getMontantAPayer(e: Echeance): number {
  const base = e.montant;

  const daysLate = this.getDaysLate(e.dateFin);

  if (daysLate <= 0) return base;

  const penaltyRate = 0.02; 
  const monthsLate = Math.ceil(daysLate / 30);

  const penalty = base * penaltyRate * monthsLate;

  return base + penalty;
}
 
getNextPayableEcheance(): Echeance | null {
  const sorted = [...this.selectedEcheances]
    .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));

  const overdue = sorted.find(e => e.statut === 'EN_RETARD');
  if (overdue) return overdue;

  return sorted.find(e => e.statut === 'EN_ATTENTE') ?? null;
}
getDaysLate(dateFin: string): number {
  const today = new Date();
  const due = new Date(dateFin);

  const diff = today.getTime() - due.getTime();

  if (diff <= 0) return 0;

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
payerEcheance(): void {
  if (!this.selectedPretId) return;

  const e = this.getNextPayableEcheance();
  if (!e?.id) return;

  const echeanceId = e.id;

  this.paiementService.createAgriculteurIntent(echeanceId)
    .subscribe({
      next: (res: any) => {

        this.stripe!.confirmCardPayment(res.clientSecret, {
          payment_method: {
            card: this.card, 
          }
        }).then(result => {

          if (result.paymentIntent?.status === 'succeeded') {

            this.echeanceService.payer(echeanceId)
              .subscribe(() => {
                this.refreshEcheances();
                this.selectPret(this.selectedPret!);
              });

          } else {
            console.error("Paiement échoué", result);
          }

        });

      },
      error: (err) => {
        console.error("Erreur Stripe backend", err);
      }
    });
}
refreshEcheances(): void {
  if (!this.selectedPretId) return;

  this.echeanceService.getEcheancesByPret(this.selectedPretId)
    .subscribe(data => {
      this.selectedEcheances = data;
      this.buildKpis();
    });
}
}