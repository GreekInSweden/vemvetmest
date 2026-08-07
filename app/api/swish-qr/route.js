// Anropar Swishs egna officiella "Prefilled QR"-API server-side (ingen
// autentisering krävs för detta specifika anrop) och skickar tillbaka
// bilden som en data-URL. Detta ersätter det tidigare försöket att bygga
// en swish://-länk och skicka den till en generisk QR-bildtjänst, som
// inte gav en bild i det format Swish-appens skanner faktiskt förväntar
// sig.
export async function POST(request) {
  try {
    const { payeeNumber, amount, message } = await request.json();

    const swishRes = await fetch('https://mpc.getswish.net/qrg-swish/api/v1/prefilled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: 'png',
        size: 300,
        payee: { value: payeeNumber, editable: false },
        amount: { value: amount, editable: false },
        message: { value: message, editable: false }
      })
    });

    if (!swishRes.ok) {
      const text = await swishRes.text();
      return Response.json({ error: `Swish API svarade ${swishRes.status}: ${text}` }, { status: 500 });
    }

    const buffer = await swishRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return Response.json({ image: `data:image/png;base64,${base64}` });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
