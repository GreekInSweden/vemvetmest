// Bygger en Swish-betalningslänk enligt Swishs officiella deep link-format
// (swish://payment?data=...). Fungerar som QR-kod (skannas) eller klickbar
// länk på mobil. Belopp och mottagare låsta, meddelande valfritt låst.
export function buildSwishLink({ payeeNumber, amount, message, editableMessage = false }) {
  const payload = {
    version: 1,
    payee: { value: payeeNumber, editable: false },
    amount: { value: amount, editable: false },
    message: { value: message, editable: editableMessage }
  };
  return 'swish://payment?data=' + encodeURIComponent(JSON.stringify(payload));
}

// Publik, gratis QR-genereringstjänst - ingen nyckel eller konto behövs.
export function swishQrImageUrl(swishLink, size = 280) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(swishLink)}`;
}

export const SWISH_NUMBER = '0700500510';

export const PLAN_PRICES = {
  monthly: { amount: 29, days: 31, label: 'Månadsvis' },
  yearly: { amount: 299, days: 366, label: 'Helår' },
  family: { amount: 897, days: 366, label: 'Familj' }
};

// Företagsplan: samma pris per plats som familjeplanen (897/4), men
// skalbart till valfritt antal. 366 dagar, precis som Familj/Helår.
export const COMPANY_PRICE_PER_SEAT = 224;
export const COMPANY_MIN_SEATS = 5; // 4 eller färre => använd Familj istället
export const COMPANY_DAYS = 366;
