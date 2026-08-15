export const metadata = { title: 'Villkor — Kan Du Alla' };

export default function VillkorPage() {
  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">&larr; Alla spel</a>
      </div>

      <header style={{ marginBottom: 24 }}>
        <div className="eyebrow">Juridiskt</div>
        <h1 className="brand" style={{ fontSize: 32 }}>Allmänna villkor</h1>
        <p className="subhead">Senast uppdaterad: [DATUM] &middot; Gäller från: [DATUM]</p>
      </header>

      <div className="panel" style={{ maxWidth: 720, lineHeight: 1.7 }}>

        <p className="subhead" style={{ marginBottom: 20 }}>
          Det här är villkoren för Kan Du Alla ("tjänsten", "vi", "oss"). Genom att skapa ett
          konto eller använda tjänsten godkänner du dessa villkor.
        </p>

        <div className="cat-title" style={{ marginTop: 0 }}>1. Om tjänsten</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Kan Du Alla är en webbaserad tjänst för kunskapsspel där man fyller i rankade listor.
          Tjänsten tillhandahålls av [FÖRETAGSNAMN], org.nr [ORGANISATIONSNUMMER], [ADRESS]
          ("tjänsteleverantören").
        </p>

        <div className="cat-title">2. Konto</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Vissa delar av tjänsten (gratisspel) kan användas utan konto. För Dagens utmaning,
          ligor, topplistor och Barnpaketet krävs ett konto med användarnamn och lösenord. Du
          ansvarar för att uppgifterna du lämnar är korrekta och för att hålla ditt lösenord
          hemligt. Du är själv ansvarig för allt som sker via ditt konto.
        </p>

        <div className="cat-title">3. Medlemskap och priser</div>
        <p className="subhead" style={{ marginBottom: 8 }}>Vi erbjuder följande betalda planer:</p>
        <ul className="subhead" style={{ marginBottom: 20, paddingLeft: 20 }}>
          <li><b style={{ color: 'var(--amber-glow)' }}>Månadsvis</b> — 29 kr, gäller cirka en månad från betalning</li>
          <li><b style={{ color: 'var(--amber-glow)' }}>Helår</b> — 299 kr, gäller ett år från betalning</li>
          <li><b style={{ color: 'var(--amber-glow)' }}>Familj</b> — 897 kr/år för upp till 4 konton</li>
          <li><b style={{ color: 'var(--amber-glow)' }}>Företag</b> — pris per plats och år, minst 5 platser</li>
          <li><b style={{ color: 'var(--amber-glow)' }}>Barnpaket</b> — 99 kr/år, ger tillgång till ett separat, växande
            bibliotek av barnanpassade spel. Betalning görs och hanteras av en förälder/vårdnadshavare
            på barnets vägnar.</li>
        </ul>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Priserna kan komma att ändras. Prisändringar gäller inte redan betalda, pågående perioder.
        </p>

        <div className="cat-title">4. Betalning</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Betalning sker via Swish till [SWISH-NUMMER]. Medlemskapet aktiveras manuellt av oss efter
          att betalningen har registrerats, vilket normalt sker inom [TIDSRAM, t.ex. "24 timmar"].
          Vi hanterar aldrig dina kort- eller bankuppgifter — dessa hanteras helt av Swish, utanför
          vår tjänst.
        </p>

        <div className="cat-title">5. Ångerrätt</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Enligt distansavtalslagen har du som konsument normalt 14 dagars ångerrätt vid köp på
          distans. Eftersom tjänsten är digitalt innehåll som levereras direkt (kontot aktiveras
          och blir tillgängligt så fort betalningen registrerats), <b>samtycker du i samband med
          köpet till att tjänsten påbörjas omedelbart</b> och att du därmed förlorar din ångerrätt
          så fort medlemskapet aktiverats, i enlighet med undantaget för digitalt innehåll i
          distansavtalslagen. Vill du inte samtycka till detta, kontakta oss innan du betalar.
          <br /><br />
          <i>[Den här paragrafen är särskilt viktig att en jurist går igenom — kraven på hur och
          när samtycket till förlorad ångerrätt ska inhämtas är specifika, och vi har inte byggt
          något separat samtyckessteg i betalningsflödet ännu.]</i>
        </p>

        <div className="cat-title">6. Uppsägning och avslut</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Medlemskapet upphör automatiskt vid periodens slut och förnyas inte automatiskt — du
          väljer själv att betala igen för en ny period. Du kan när som helst sluta använda
          tjänsten. Vi tillhandahåller ingen delvis återbetalning för outnyttjad tid inom en
          redan betald period, om inte annat följer av tvingande konsumenträtt.
        </p>

        <div className="cat-title">7. Barn och Barnpaketet</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Barnkonton skapas av en förälder/vårdnadshavare, som ansvarar för kontot och för
          betalningen. Barnpaketet är en separat, permanent* prenumeration knuten till det
          specifika barnkontot och förnyas årsvis av vårdnadshavaren.
          <br /><br />
          <i>[*Justera formuleringen här beroende på om ni landar i "permanent tillgång så länge
          prenumerationen är aktiv" eller annan modell — se till att den matchar det som faktiskt
          visas på prenumerationssidan.]</i>
        </p>

        <div className="cat-title">8. Innehåll och immateriella rättigheter</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Allt innehåll i tjänsten (spel, listor, texter, grafik, varumärket "Kan Du Alla") ägs av
          [FÖRETAGSNAMN] eller våra licensgivare. Du får inte kopiera, sprida eller använda
          innehållet kommersiellt utan skriftligt tillstånd.
        </p>

        <div className="cat-title">9. Ansvarsbegränsning</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Tjänsten tillhandahålls i befintligt skick. Vi strävar efter hög tillgänglighet men
          garanterar inte att tjänsten alltid är felfri eller tillgänglig utan avbrott. Vi ansvarar
          inte för indirekta skador eller förluster som uppstår i samband med användning av
          tjänsten, i den utsträckning det är tillåtet enligt tvingande lag.
        </p>

        <div className="cat-title">10. Personuppgifter</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Vi behandlar personuppgifter (som användarnamn, betalningsstatus och spelresultat) för
          att kunna tillhandahålla tjänsten. Läs mer i vår <a href="/integritetspolicy">integritetspolicy</a>.
          <br /><br />
          <i>[Den sidan finns inte byggd än — säg till om du vill att jag bygger den också, det
          är ett separat men lika viktigt dokument, särskilt eftersom ni hanterar uppgifter om
          barn.]</i>
        </p>

        <div className="cat-title">11. Ändringar av villkoren</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Vi kan komma att uppdatera dessa villkor. Väsentliga ändringar meddelas via e-post eller
          i tjänsten innan de träder i kraft. Fortsatt användning efter en ändring innebär att du
          godkänner de nya villkoren.
        </p>

        <div className="cat-title">12. Tillämplig lag och tvist</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Svensk lag gäller för dessa villkor. Vid tvist rekommenderar vi i första hand att
          kontakta oss direkt. Du har även rätt att vända dig till Allmänna reklamationsnämnden
          (ARN) eller allmän domstol.
        </p>

        <div className="cat-title">13. Kontakt</div>
        <p className="subhead" style={{ marginBottom: 0 }}>
          Frågor om dessa villkor? Kontakta oss på [E-POSTADRESS].
        </p>

      </div>
    </div>
  );
}
