import { Component, Input } from '@angular/core';
import { AiRecipeService } from '../../../services/ai-recipe.service';
import { CartService } from '../../../services/cart/cart.service';

interface ChatMessage {
  sender: 'user' | 'bot';
  text?: string;
  result?: any;
  loading?: boolean;
}

@Component({
  selector: 'app-recipe-chatbot',
  templateUrl: './recipe-chatbot.component.html',
  styleUrls: ['./recipe-chatbot.component.css']
})
export class RecipeChatbotComponent {
  @Input() currentUserId: number | null = null;
  @Input() openReservationPopup!: (title: string, message: string, type?: 'success' | 'error') => void;

  isOpen = false;
  prompt = '';
  sending = false;

  messages: ChatMessage[] = [
    {
      sender: 'bot',
      text: 'Hi! I can suggest recipes from available marketplace products and build your cart.'
    }
  ];

  quickPrompts: string[] = [
    'Give me a Tunisian recipe',
    'Make me a dinner under 20 DT',
    'What can I cook with available vegetables?',
    'Suggest a vegetarian meal'
  ];

  constructor(
    private aiRecipeService: AiRecipeService,
    private cartService: CartService
  ) {}

  toggleChat(): void {
    this.isOpen = !this.isOpen;
  }

  useQuickPrompt(value: string): void {
    this.prompt = value;
    this.sendMessage();
  }

  sendMessage(): void {
    const trimmed = this.prompt.trim();

    if (!trimmed) {
      return;
    }

    if (!this.currentUserId) {
      this.openReservationPopup?.('Login Required', 'Please sign in first.', 'error');
      return;
    }

    this.messages.push({
      sender: 'user',
      text: trimmed
    });

    const loadingMessage: ChatMessage = {
      sender: 'bot',
      loading: true,
      text: 'Thinking...'
    };

    this.messages.push(loadingMessage);
    this.sending = true;

    const currentPrompt = trimmed;
    this.prompt = '';

    this.aiRecipeService.generateRecipeCart({
      userId: this.currentUserId,
      prompt: currentPrompt,
      addToCart: false
    }).subscribe({
      next: (res) => {
        this.messages = this.messages.filter(m => m !== loadingMessage);
        this.messages.push({
          sender: 'bot',
          result: res
        });
        this.sending = false;
      },
      error: (err) => {
        this.messages = this.messages.filter(m => m !== loadingMessage);
        this.messages.push({
          sender: 'bot',
          text: err?.error?.message || 'Sorry, something went wrong while generating your recipe.'
        });
        this.sending = false;
      }
    });
  }

  addMatchedItemsToCart(result: any): void {
    if (!this.currentUserId) {
      this.openReservationPopup?.('Login Required', 'Please sign in first.', 'error');
      return;
    }

    this.aiRecipeService.generateRecipeCart({
      userId: this.currentUserId,
      prompt: this.extractOriginalPromptFromLastUserMessage(),
      addToCart: true
    }).subscribe({
      next: () => {
        this.cartService.refreshCartCount();
        this.openReservationPopup?.(
          'Recipe Cart Ready',
          'Matched ingredients were added to your cart.',
          'success'
        );
      },
      error: (err) => {
        this.openReservationPopup?.(
          'Cart Error',
          err?.error?.message || 'Failed to add matched items to cart.',
          'error'
        );
      }
    });
  }

  private extractOriginalPromptFromLastUserMessage(): string {
    const reversed = [...this.messages].reverse();
    const lastUser = reversed.find(m => m.sender === 'user' && m.text?.trim());
    return lastUser?.text || '';
  }

  onEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.sendMessage();
    }
  }

  isUnsupported(result: any): boolean {
    return result?.recipeTitle === 'Unsupported Request';
  }
}