import { Component, Input, OnInit } from '@angular/core';
import { DeliveryExtendedService, TransporterStats } from '../../services/delivery-extended.service';

@Component({
  selector: 'app-transporter-stats',
  templateUrl: './transporter-stats.component.html',
  styleUrls: ['./transporter-stats.component.css']
})
export class TransporterStatsComponent implements OnInit {
  @Input() transporteurId: number = 0;
  @Input() periodMonths: number = 6;

  stats: TransporterStats | null = null;
  advancedStats: any = null;
  isLoading: boolean = false;
  selectedPeriod: number = 6;

  // Pour les graphiques
  monthlyData: { month: string; count: number }[] = [];
  productTypeData: { type: string; count: number }[] = [];
  advancedStatsEntries: Array<{ label: string; value: string }> = [];
  hasRealBaseData = false;
  private latestAdvancedStats: any = null;

  constructor(private deliveryService: DeliveryExtendedService) {}

  ngOnInit(): void {
    this.selectedPeriod = this.periodMonths;
    this.loadStats();
  }

  loadStats(): void {
    if (!this.transporteurId) return;
    
    this.isLoading = true;
    this.hasRealBaseData = false;
    this.latestAdvancedStats = null;
    this.advancedStats = null;
    this.advancedStatsEntries = [];
    
    // Charger les statistiques de base
    this.deliveryService.getTransporterStats(this.transporteurId).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.hasRealBaseData = this.hasMeaningfulBaseData(stats);
        this.processMonthlyData(stats?.monthlyDeliveries || {});
        this.processProductTypeData(stats?.productTypes || {});
        this.refreshAdvancedEntries();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des statistiques:', err);
        this.stats = null;
        this.hasRealBaseData = false;
        this.advancedStatsEntries = [];
        this.isLoading = false;
      }
    });

    // Charger les statistiques avancées
    this.deliveryService.getTransporterAdvancedStats(this.transporteurId, this.selectedPeriod).subscribe({
      next: (advancedStats) => {
        this.latestAdvancedStats = advancedStats;
        this.advancedStats = advancedStats;
        this.refreshAdvancedEntries();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des statistiques avancées:', err);
        this.latestAdvancedStats = null;
        this.advancedStats = null;
        this.advancedStatsEntries = [];
      }
    });
  }

  private refreshAdvancedEntries(): void {
    // Do not show advanced KPIs when base stats say there is no real activity.
    if (!this.hasRealBaseData) {
      this.advancedStatsEntries = [];
      return;
    }
    this.advancedStatsEntries = this.toAdvancedEntries(this.latestAdvancedStats);
  }

  private hasMeaningfulBaseData(stats: TransporterStats | null): boolean {
    if (!stats) {
      return false;
    }
    return Number(stats.total || 0) > 0;
  }

  onPeriodChange(period: number): void {
    this.selectedPeriod = period;
    this.loadStats();
  }

  processMonthlyData(monthlyDeliveries: { [key: string]: number }): void {
    this.monthlyData = Object.entries(monthlyDeliveries)
      .map(([month, count]) => {
        const [year, monthNum] = month.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return {
          month: `${monthNames[parseInt(monthNum) - 1]} ${year}`,
          count
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12); // Limiter aux 12 derniers mois
  }

  processProductTypeData(productTypes: { [key: string]: number }): void {
    this.productTypeData = Object.entries(productTypes)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 des types de produits
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(price);
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('fr-FR').format(num);
  }

  getRatingStars(rating: number): number[] {
    return Array(5).fill(0).map((_, i) => {
      if (rating >= i + 1) return 1;
      if (rating >= i + 0.5) return 0.5;
      return 0;
    });
  }

  getGlobalRatingValue(): number {
    if (!this.stats) return 0;
    return this.stats.globalAvgRating ?? this.stats.avgRating ?? 0;
  }

  getGlobalRatingCount(): number {
    if (!this.stats) return 0;
    return this.stats.globalRatedDeliveries ?? this.stats.ratedDeliveries ?? 0;
  }

  private toAdvancedEntries(advancedStats: any): Array<{ label: string; value: string }> {
    if (!advancedStats || typeof advancedStats !== 'object') {
      return [];
    }

    return Object.entries(advancedStats)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => ({
        label: this.humanizeKey(key),
        value: String(value)
      }));
  }

  private humanizeKey(key: string): string {
    const withSpaces = key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim();

    if (!withSpaces) {
      return key;
    }

    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
  }
}
