# Module de Livraison - Frontend Angular

Ce module a été amélioré avec de nouvelles fonctionnalités correspondant au backend amélioré.

## 🚀 Nouvelles Fonctionnalités

### 1. **Négociation avec Barre +/-5%**
Une interface interactive pour négocier les prix de livraison avec une limite de ±5%.

#### Composants:
- `NegotiationComponent` - Composant principal de négociation
- `DeliveryWithNegotiationComponent` - Intégration dans les pages de détails

#### Utilisation:
```html
<app-negotiation
  [livraisonId]="delivery.id"
  [currentUserId]="currentUserId"
  [userRole]="'transporteur'"
  [livraison]="delivery"
  (negotiationCompleted)="onNegotiationCompleted($event)"
  (negotiationError)="onNegotiationError($event)">
</app-negotiation>
```

#### Routes:
- `/delivery/transporter-calendar` - Calendrier avec négociation intégrée
- `/delivery/stats` - Statistiques avec historique des négociations

### 2. **Calendrier du Transporteur**
Vue mensuelle détaillée avec icônes des jours de livraison et statistiques.

#### Composants:
- `TransporterCalendarComponent` - Composant calendrier interactif
- `TransporterCalendarPageComponent` - Page wrapper

#### Fonctionnalités:
- Vue mensuelle avec navigation
- Icônes de statut par jour
- Statistiques quotidiennes (livraisons, revenus)
- Détails des livraisons par jour
- Résumé mensuel

#### Utilisation:
```html
<app-transporter-calendar
  [transporteurId]="currentUserId"
  (dateSelected)="onDateSelected($event)"
  (deliverySelected)="onDeliverySelected($event)">
</app-transporter-calendar>
```

### 3. **Statistiques Avancées du Transporteur**
Tableau de bord complet avec graphiques et analyses.

#### Composants:
- `TransporterStatsComponent` - Composant statistiques
- `TransporterStatsPageComponent` - Page wrapper

#### Fonctionnalités:
- Statistiques principales (livraisons, revenus, taux de réussite)
- Graphiques d'évolution mensuelle
- Répartition par type de produits
- Évaluations et performances
- Statistiques avancées personnalisables

### 4. **Gestion des Groupes de Livraison**
Interface pour créer et gérer des groupes optimisés.

#### Composants:
- `GroupsManagementComponent` - Composant gestion des groupes
- `GroupsManagementPageComponent` - Page wrapper

#### Fonctionnalités:
- Création de groupes depuis des livraisons existantes
- Statistiques par groupe (économies, completion)
- Vue détaillée des livraisons groupées
- Calcul automatique des optimisations

### 5. **Système de Notifications**
Centre de notification complet avec gestion des négociations.

#### Composants:
- `NotificationsComponent` - Centre de notifications

#### Fonctionnalités:
- Notifications en temps réel
- Filtrage par type et statut
- Actions directes sur les notifications
- Gestion des négociations depuis les notifications
- Badge de compteur non lus

#### Utilisation:
```html
<app-notifications
  [userId]="currentUserId"
  [showUnreadOnly]="false"
  (notificationAction)="onNotificationAction($event)"
  (deliverySelected)="onDeliverySelected($event)">
</app-notifications>
```

## 🛠 Services

### DeliveryExtendedService
Service étendu pour communiquer avec le nouveau backend:

```typescript
// Négociation
getNegociationRange(livraisonId: number)
negocierAvecBarre(livraisonId: number, transporteurId: number, prixPropose: number)
accepterNegociationBarre(livraisonId: number, agriculteurId: number)
refuserNegociationBarre(livraisonId: number, agriculteurId: number)

// Calendrier
getTransporterCalendar(transporteurId: number, year: number, month: number)
getTransporterCalendarSummary(transporteurId: number, year: number, month: number)

// Statistiques
getTransporterStats(transporteurId: number)
getTransporterAdvancedStats(transporteurId: number, periodMonths: number)

// Groupes
getTransporterGroups(transporteurId: number)
getGroupDetails(groupReference: string, transporteurId: number)
createGroupFromDeliveries(transporteurId: number, livraisonIds: number[])

// Notifications
getNotificationsForUser(userId: number)
getUnreadNotificationsCount(userId: number)
handleNotificationAction(notificationId: number, actorId: number, action: string, counterPrice?: number)
```

## 📱 Routes Disponibles

| Route | Composant | Description |
|-------|-----------|-------------|
| `/delivery/transporter-calendar` | `TransporterCalendarPageComponent` | Calendrier du transporteur |
| `/delivery/stats` | `TransporterStatsPageComponent` | Statistiques du transporteur |
| `/delivery/groups-management` | `GroupsManagementPageComponent` | Gestion des groupes |
| `/delivery/create` | `DeliveryCreateComponent` | Créer une livraison |
| `/delivery/active` | `DeliveryActiveComponent` | Livraisons actives |
| `/delivery/demandes` | `DeliveryDemandesComponent` | Demandes en cours |
| `/delivery/history` | `DeliveryHistoryComponent` | Historique |

## 🎨 Intégration UI

### Intégrer la négociation dans une page existante:

```html
<!-- Dans un composant de détails de livraison -->
<app-delivery-with-negotiation
  [delivery]="selectedDelivery"
  (negotiationCompleted)="refreshDelivery()"
  (negotiationError)="showError($event)">
</app-delivery-with-negotiation>
```

### Intégrer les notifications dans le header:

```html
<!-- Dans le composant header/navigation -->
<app-notifications
  [userId]="currentUserId"
  (notificationAction)="handleNotificationAction($event)">
</app-notifications>
```

## 🔧 Configuration

### Dependencies requises:
- Angular Material Icons (pour les icônes)
- FormsModule et ReactiveFormsModule (pour les formulaires)
- HttpClientModule (pour les appels API)

### Installation des icônes:
```bash
npm install @angular/material
```

Ajouter dans `app.module.ts`:
```typescript
import { MatIconModule } from '@angular/material/icon';

@NgModule({
  imports: [
    // ... autres imports
    MatIconModule
  ]
})
```

## 📊 Types et Interfaces

### Principales interfaces:
```typescript
interface NegotiationRange {
  livraisonId: number;
  prixBase: number;
  prixMin: number;
  prixMax: number;
  variationPourcent: number;
  statutActuel: string;
  enNegociation: boolean;
}

interface CalendarDay {
  date: string;
  jourSemaine: string;
  hasDeliveries: boolean;
  totalDeliveries: number;
  enCours: number;
  acceptees: number;
  livrees: number;
  revenueJour: number;
  items: CalendarItem[];
  // ...
}

interface DeliveryNotification {
  id: number;
  fromUserId: number;
  toUserId: number;
  livraisonId: number;
  type: string;
  title: string;
  message: string;
  proposedPrice?: number;
  status: string;
  createdAt: string;
  seen: boolean;
}
```

## 🚨 Notes importantes

1. **Compatibilité**: Les nouveaux composants sont compatibles avec l'architecture existante
2. **Responsive**: Tous les composants sont adaptés pour mobile et desktop
3. **Performance**: Utilisation de lazy loading et optimisation des appels API
4. **Accessibilité**: Support des attributs ARIA et navigation au clavier
5. **Theming**: Utilisation de variables CSS pour une personnalisation facile

## 🔄 Mises à jour futures

- Graphiques interactifs avec Chart.js
- Export des statistiques en PDF/Excel
- Notifications push en temps réel
- Optimisation automatique des groupes
- Intégration carte pour les trajets
