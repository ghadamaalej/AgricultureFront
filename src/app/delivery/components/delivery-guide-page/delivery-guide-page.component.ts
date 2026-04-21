import { Component } from '@angular/core';

@Component({
  selector: 'app-delivery-guide-page',
  templateUrl: './delivery-guide-page.component.html',
  styleUrls: ['./delivery-guide-page.component.css']
})
export class DeliveryGuidePageComponent {
  highlights = [
    {
      title: 'Creer une demande',
      text: 'Ouvrez Creer, renseignez les adresses et choisissez le creneau de livraison.'
    },
    {
      title: 'Suivre une livraison',
      text: 'Allez dans Suivi pour consulter la progression de votre demande en cours.'
    },
    {
      title: 'Consulter l historique',
      text: 'La page Historique affiche les livraisons terminees et leurs details.'
    }
  ];
}
