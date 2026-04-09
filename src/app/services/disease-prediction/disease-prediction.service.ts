import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface PredictionResponse {
  predicted_class: string;
  confidence: number;
  top3: Array<{
    class: string;
    confidence: number;
  }>;
}

export interface PredictionResult {
  predicted_class: string;
  confidence: number;
  top3: Array<{
    class: string;
    confidence: number;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class DiseasePredictionService {
  private apiUrl = environment.plantDiseaseApiUrl;

  constructor() {}

  /**
   * Predicts disease from a leaf image
   * @param file The image file to analyze
   * @returns Promise with prediction result
   */
  async predictDisease(file: File): Promise<PredictionResult> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${this.apiUrl}/predict`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data: PredictionResponse = await response.json();
      
      return {
        predicted_class: data.predicted_class,
        confidence: data.confidence,
        top3: data.top3 || []
      };
    } catch (error) {
      console.error('Disease prediction error:', error);
      throw error;
    }
  }
}

