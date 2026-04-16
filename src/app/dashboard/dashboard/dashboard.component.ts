import { Component, AfterViewInit, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements AfterViewInit, OnDestroy {

  @ViewChild('revenueChart')  revenueChartRef!:  ElementRef;
  @ViewChild('usersChart')    usersChartRef!:    ElementRef;
  @ViewChild('deliveryChart') deliveryChartRef!: ElementRef;
  @ViewChild('categoryChart') categoryChartRef!: ElementRef;

  private revenueChart?: Chart;
  private usersChart?: Chart;
  private deliveryChart?: Chart;
  private categoryChart?: Chart;

  stats = [
    { icon: 'fas fa-seedling',       value: '12,540', label: 'Active Farmers',    color: '#4caf50', bg: '#eaf5ea' },
    { icon: 'fas fa-handshake',      value: '8,320',  label: 'Transactions',      color: '#ff8f00', bg: '#fff8e1' },
    { icon: 'fas fa-truck',          value: '1,240',  label: 'Deliveries Today',  color: '#00acc1', bg: '#e0f7fa' },
    { icon: 'fas fa-stethoscope',    value: '340',    label: 'Vet Consultations', color: '#7b1fa2', bg: '#f3e5f5' },
    { icon: 'fas fa-graduation-cap', value: '95',     label: 'Active Experts',    color: '#e53935', bg: '#ffebee' },
    { icon: 'fas fa-calendar-alt',   value: '18',     label: 'Upcoming Events',   color: '#1565c0', bg: '#e3f2fd' },
  ];

  recentTransactions = [
    { user: 'Ahmed Ben Ali',   role: 'Farmer',      action: 'Listed 200kg Tomatoes',    amount: '+$480',   status: 'completed', time: '2 min ago',  avatar: 'AB' },
    { user: 'Sara Mansour',    role: 'Buyer',       action: 'Purchased Wheat Bundle',   amount: '-$1,200', status: 'completed', time: '15 min ago', avatar: 'SM' },
    { user: 'Karim Logistics', role: 'Transporter', action: 'Delivery to Tunis Hub',    amount: '+$320',   status: 'transit',   time: '32 min ago', avatar: 'KL' },
    { user: 'Dr. Leila Hamdi', role: 'Vet',         action: 'Online Consultation x3',   amount: '+$150',   status: 'completed', time: '1 hr ago',   avatar: 'LH' },
    { user: 'Omar Farms',      role: 'Farmer',      action: 'Equipment Rental Request', amount: '-$90',    status: 'pending',   time: '2 hr ago',   avatar: 'OF' },
    { user: 'Nour Agri',       role: 'Expert',      action: 'Published New Course',     amount: '+$600',   status: 'completed', time: '3 hr ago',   avatar: 'NA' },
  ];

  topFarmers = [
    { name: 'Ahmed Ben Ali', region: 'Tunis',   sales: '$12,400', growth: '+18%', positive: true  },
    { name: 'Omar Farms',    region: 'Sfax',    sales: '$9,800',  growth: '+12%', positive: true  },
    { name: 'Leila Agri',    region: 'Sousse',  sales: '$7,200',  growth: '-3%',  positive: false },
    { name: 'Nour Organic',  region: 'Bizerte', sales: '$6,500',  growth: '+22%', positive: true  },
    { name: 'Karim Fields',  region: 'Nabeul',  sales: '$5,900',  growth: '+8%',  positive: true  },
  ];

  ngAfterViewInit(): void {
    this.initRevenueChart();
    this.initUsersChart();
    this.initDeliveryChart();
    this.initCategoryChart();
  }

  ngOnDestroy(): void {
    this.revenueChart?.destroy();
    this.usersChart?.destroy();
    this.deliveryChart?.destroy();
    this.categoryChart?.destroy();
  }

  initRevenueChart(): void {
    this.revenueChart = new Chart(this.revenueChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
        datasets: [
          {
            label: 'Revenue ($)',
            data: [42000,55000,48000,70000,63000,85000,91000,78000,95000,110000,102000,125000],
            borderColor: '#4caf50',
            backgroundColor: 'rgba(76,175,80,0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#4caf50',
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: 'Expenses ($)',
            data: [28000,32000,30000,41000,38000,50000,54000,46000,58000,65000,60000,72000],
            borderColor: '#ff8f00',
            backgroundColor: 'rgba(255,143,0,0.06)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#ff8f00',
            pointRadius: 3,
            pointHoverRadius: 5,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 12, family: 'Poppins' }, usePointStyle: true } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11, family: 'Poppins' } } },
          y: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { font: { size: 11, family: 'Poppins' }, callback: (v: any) => '$' + (v / 1000) + 'k' }
          }
        }
      }
    });
  }

  initUsersChart(): void {
    this.usersChart = new Chart(this.usersChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
        datasets: [
          { label: 'New Farmers',      data: [320,410,390,520,480,610,590,670,720,800,760,920], backgroundColor: 'rgba(76,175,80,0.75)',  borderRadius: 6, borderSkipped: false },
          { label: 'New Buyers',       data: [180,220,200,290,260,340,310,380,420,460,440,510], backgroundColor: 'rgba(255,143,0,0.75)',  borderRadius: 6, borderSkipped: false },
          { label: 'New Transporters', data: [60,80,75,95,88,110,105,120,135,150,142,170],      backgroundColor: 'rgba(0,172,193,0.75)',  borderRadius: 6, borderSkipped: false }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 12, family: 'Poppins' }, usePointStyle: true } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11, family: 'Poppins' } } },
          y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11, family: 'Poppins' } } }
        }
      }
    });
  }

  initDeliveryChart(): void {
    this.deliveryChart = new Chart(this.deliveryChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'In Transit', 'Pending', 'Cancelled'],
        datasets: [{
          data: [68, 18, 10, 4],
          backgroundColor: ['#4caf50', '#00acc1', '#ff8f00', '#e53935'],
          borderWidth: 0,
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 12, family: 'Poppins' }, usePointStyle: true, padding: 16 } }
        }
      }
    });
  }

  initCategoryChart(): void {
    this.categoryChart = new Chart(this.categoryChartRef.nativeElement, {
      type: 'radar',
      data: {
        labels: ['Vegetables', 'Fruits', 'Grains', 'Livestock', 'Dairy', 'Herbs'],
        datasets: [
          { label: 'This Month', data: [85,72,90,45,60,38], borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.15)', borderWidth: 2, pointBackgroundColor: '#4caf50', pointRadius: 4 },
          { label: 'Last Month', data: [70,60,80,50,55,30], borderColor: '#ff8f00', backgroundColor: 'rgba(255,143,0,0.1)',  borderWidth: 2, pointBackgroundColor: '#ff8f00', pointRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 12, family: 'Poppins' }, usePointStyle: true } } },
        scales: {
          r: {
            grid: { color: 'rgba(0,0,0,0.06)' },
            pointLabels: { font: { size: 11, family: 'Poppins' } },
            ticks: { display: false }
          }
        }
      }
    });
  }
}