// Swishs FAKTISKA QR-länkformat, bekräftat genom att avläsa en riktig
// QR-kod genererad av Swish själva (2026-08-07). Detta är en vanlig
// https-länk, INTE swish://-deep-linken som annars nämns på forum -
// den funkar för att klicka på direkt på mobilen, men Swish-appens
// egen QR-skanner förväntar sig detta https-format istället.
//
// Parametrar: sw=nummer, amt=belopp, cur=valuta, msg=meddelande,
// edit=kommaseparerad lista över vilka fält som ska vara redigerbara
// (t.ex. "msg" eller "amt,msg"). Tom sträng = allt låst.
// Swishs FAKTISKA QR-länkformat, bekräftat genom att avläsa TVÅ riktiga
// QR-koder genererade av Swish själva (2026-08-07): en med bara belopp
// låst (gav "...&edit=msg&src=qr") och en med BÅDE belopp och meddelande
// låst (gav "...&msg=Test&src=qr" - notera: ingen edit-parameter alls när
// inget är redigerbart, INTE en tom edit=). Detta är en vanlig https-länk,
// inte swish://-deep-linken som annars nämns på forum.
export function buildSwishLink({ payeeNumber, amount, message, editableFields = [] }) {
  const params = new URLSearchParams({
    sw: payeeNumber,
    amt: String(amount),
    cur: 'SEK',
    msg: message
  });
  if (editableFields.length > 0) {
    params.set('edit', editableFields.join(','));
  }
  params.set('src', 'qr');
  return `https://app.swish.nu/1/p/sw/?${params.toString()}`;
}

// Publik, gratis QR-genereringstjänst - ingen nyckel eller konto behövs.
// OBS: används inte längre för själva betalnings-QR:n (se QrCode-
// komponenten i prenumerera/page.js som ritar den lokalt med biblioteket
// "qrcode" istället, för full kontroll över exakt vad som kodas).
export function swishQrImageUrl(swishLink, size = 280) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(swishLink)}`;
}

export const SWISH_NUMBER = '0700500510';

export const PLAN_PRICES = {
  monthly: { amount: 29, days: 31, label: 'Månadsvis' },
  yearly: { amount: 299, days: 366, label: 'Helår' },
  family: { amount: 897, days: 366, label: 'Familj' }
};

// Barnpaket: engångssumma, permanent tillgång till 50 utvalda spel för
// barn - helt separat från de vanliga planerna, ingen förnyelse.
export const CHILD_PACKAGE_PRICE = 99;

// Extra liv: 29 kr styck, köps ett i taget utöver de fem gratis liven
// per år. Samma manuella Swish + admin-aktivering som allt annat.
export const EXTRA_LIFE_PRICE = 29;

// Företagsplan: samma pris per plats som familjeplanen (897/4), men
// skalbart till valfritt antal. 366 dagar, precis som Familj/Helår.
export const COMPANY_PRICE_PER_SEAT = 224;
export const COMPANY_MIN_SEATS = 5; // 4 eller färre => använd Familj istället
export const COMPANY_DAYS = 366;
