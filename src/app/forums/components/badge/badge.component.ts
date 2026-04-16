import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-badge',
  templateUrl: './badge.component.html',
  styleUrls: ['./badge.component.css']
})
export class BadgeComponent {
  @Input() reputation: number = 0;
  @Input() badgeTier?: string;

  getBadgeInfo() {
    if (this.reputation >= 1500) {
      return {
        tier: 'ELITE_GROWER',
        label: 'Elite Grower',
        emoji: '👑',
        colorClass: 'badge-platinum'
      };
    } else if (this.reputation >= 800) {
      return {
        tier: 'TRUSTED_CONTRIBUTOR',
        label: 'Trusted Contributor',
        emoji: '⭐',
        colorClass: 'badge-gold'
      };
    } else if (this.reputation >= 300) {
      return {
        tier: 'RISING_MEMBER',
        label: 'Rising Member',
        emoji: '🌟',
        colorClass: 'badge-silver'
      };
    } else {
      return {
        tier: 'NEW_MEMBER',
        label: 'New Member',
        emoji: '🌱',
        colorClass: 'badge-bronze'
      };
    }
  }
}
