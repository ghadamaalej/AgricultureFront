import { Component, OnInit } from '@angular/core';
import { DiseasePredictionService, PredictionResult } from '../../services/disease-prediction/disease-prediction.service';

@Component({
  selector: 'app-disease-predictor',
  templateUrl: './disease-predictor.component.html',
  styleUrls: ['./disease-predictor.component.css']
})
export class DiseasePredictorComponent implements OnInit {
  selectedFile: File | null = null;
  selectedFilePreview: string | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  result: PredictionResult | null = null;
  
  constructor(private diseasePredictionService: DiseasePredictionService) {}

  ngOnInit(): void {}

  /**
   * Handle file selection from input
   */
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.errorMessage = 'Please select a valid image file';
        this.selectedFile = null;
        this.selectedFilePreview = null;
        return;
      }

      this.selectedFile = file;
      this.errorMessage = null;
      this.result = null;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.selectedFilePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Trigger file input click
   */
  triggerFileInput(): void {
    const fileInput = document.getElementById('imageInput') as HTMLInputElement;
    fileInput?.click();
  }

  /**
   * Predict disease from selected image
   */
  async predictDisease(): Promise<void> {
    if (!this.selectedFile) {
      this.errorMessage = 'Please select an image file first';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.result = null;

    try {
      this.result = await this.diseasePredictionService.predictDisease(this.selectedFile);
      console.log('Prediction result:', this.result);
    } catch (error: any) {
      this.errorMessage = error.message || 'Failed to predict disease. Please try again.';
      console.error('Prediction error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Reset the predictor
   */
  reset(): void {
    this.selectedFile = null;
    this.selectedFilePreview = null;
    this.result = null;
    this.errorMessage = null;
    const fileInput = document.getElementById('imageInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  /**
   * Get confidence percentage
   */
  getConfidencePercentage(confidence: number): number {
    return Math.round(confidence * 100);
  }
}

