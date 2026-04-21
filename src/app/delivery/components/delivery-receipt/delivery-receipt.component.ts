import { Component, Input } from '@angular/core';

export type DeliveryReceiptData = {
  reference: string;
  product: string;
  weightKg: number;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm: number;
  departureDate: string;
  expectedDeliveryDate: string;
  priceTnd: number;
  farmerName: string;
  transporterName: string;
  signatureData: string;
  signedAt: string;
};

@Component({
  selector: 'app-delivery-receipt',
  standalone: false,
  templateUrl: './delivery-receipt.component.html',
  styleUrls: ['./delivery-receipt.component.css']
})
export class DeliveryReceiptComponent {
  @Input() data!: DeliveryReceiptData;

  get issuedDate(): string {
    return this.formatDate(this.data.signedAt || new Date().toISOString());
  }

  get issuedTime(): string {
    return this.formatTime(this.data.signedAt || new Date().toISOString());
  }

  print(): void {
    const doc = document.getElementById('receipt-printable');
    if (!doc) { window.print(); return; }

    const clone = doc.cloneNode(true) as HTMLElement;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { window.print(); return; }

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Delivery Receipt</title>
          <style>
            @page { size: A4 portrait; margin: 10mm 12mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { margin: 0; padding: 0; background: #fff; font-family: Arial, sans-serif; }
            .receipt-doc {
              padding: 18px 22px;
              background: #fff;
              color: #1a1a2e;
            }
            /* Header */
            .doc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
            .doc-brand { display: flex; align-items: center; gap: 8px; }
            .brand-icon { width: 32px; height: 32px; background: linear-gradient(135deg,#15803d,#22c55e); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
            .brand-name { font-size: 16px; color: #15803d; }
            .brand-name strong { font-weight: 800; }
            .doc-title-block { text-align: right; }
            .doc-title { font-size: 18px; font-weight: 800; letter-spacing: 2px; }
            .doc-subtitle { font-size: 9px; color: #6b7280; letter-spacing: 1px; text-transform: uppercase; }
            /* Meta bar */
            .doc-meta-bar { display: flex; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
            .meta-item { flex: 1; padding: 8px 12px; border-right: 1px solid #e5e7eb; }
            .meta-item:last-child { border-right: none; }
            .meta-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; display: block; }
            .meta-value { font-size: 11px; font-weight: 600; color: #1a1a2e; display: block; }
            .meta-value.ref { font-family: 'Courier New', monospace; color: #15803d; }
            .meta-value.status-delivered { color: #15803d; }
            /* Divider */
            .doc-divider { height: 1px; background: linear-gradient(to right,transparent,#d1d5db,transparent); margin: 10px 0; }
            /* Body */
            .doc-body { display: grid; grid-template-columns: 1.1fr 1fr; gap: 20px; }
            .section-title { display: flex; align-items: center; gap: 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 10px; }
            /* Table */
            .info-table { width: 100%; border-collapse: collapse; }
            .info-table tr { border-bottom: 1px solid #f3f4f6; }
            .info-table tr:last-child { border-bottom: none; }
            .info-label { padding: 5px 0; font-size: 10px; color: #6b7280; width: 38%; vertical-align: top; }
            .info-val { padding: 5px 0; font-size: 11px; color: #1a1a2e; font-weight: 500; }
            .price-row { border-top: 2px solid #e5e7eb !important; }
            .info-val.price { font-size: 14px; font-weight: 800; color: #15803d; }
            /* Parties */
            .party-card { background: #f9fafb; border: 1px solid #e5e7eb; border-left: 3px solid #15803d; border-radius: 5px; padding: 7px 10px; margin-bottom: 8px; }
            .party-role { font-size: 8px; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; }
            .party-name { font-size: 12px; font-weight: 700; color: #1a1a2e; }
            /* Confirmation */
            .confirmation-box { margin-top: 10px; padding: 10px 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; }
            .confirmation-box p { font-size: 10px; color: #4b5563; line-height: 1.6; margin: 0 0 5px; }
            .confirmation-note { font-size: 9px !important; color: #9ca3af !important; font-style: italic; }
            /* Signature */
            .signature-section { display: flex; gap: 28px; align-items: flex-end; padding-top: 6px; }
            .sig-col { flex: 1; }
            .sig-col--main { flex: 1.5; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
            .sig-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; }
            .sig-image-wrap { height: 70px; display: flex; align-items: center; margin-bottom: 6px; }
            .sig-image { max-height: 70px; max-width: 100%; object-fit: contain; }
            .sig-line { height: 1px; background: #374151; margin-bottom: 5px; }
            .sig-name { font-size: 11px; font-weight: 700; color: #1a1a2e; }
            .sig-date { font-size: 9px; color: #9ca3af; margin-top: 2px; }
            /* Footer */
            .doc-footer { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 14px; padding-top: 10px; border-top: 1px dashed #e5e7eb; font-size: 9px; color: #9ca3af; }
            .footer-dot { color: #d1d5db; }
            /* FA icons fallback */
            .fas { font-style: normal; }
          </style>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        </head>
        <body>
          <div class="receipt-doc">${clone.innerHTML}</div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          <\/script>
        </body>
      </html>
    `);
    win.document.close();
  }

  private formatDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso?.slice(0, 10) || '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  private formatTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
}
