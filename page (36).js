export const metadata = { title: 'Integritetspolicy — Kan Du Alla' };

export default function IntegritetspolicyPage() {
  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">&larr; Alla spel</a>
      </div>

      <header style={{ marginBottom: 24 }}>
        <div className="eyebrow">Juridiskt</div>
        <h1 className="brand" style={{ fontSize: 32 }}>Integritetspolicy</h1>
        <p className="subhead">Senast uppdaterad: [DATUM] &middot; Gäller från: [DATUM]</p>
      </header>

      <div className="panel" style={{ maxWidth: 720, lineHeight: 1.7 }}>

        <p className="subhead" style={{ marginBottom: 20 }}>
          Den här policyn beskriver hur [FÖRETAGSNAMN], org.nr [ORGANISATIONSNUMMER], [ADRESS]
          ("vi", "oss") behandlar personuppgifter när du använder Kan Du Alla. Se även våra{' '}
          <a href="/villkor">allmänna villkor</a>.
        </p>

        <div className="cat-title" style={{ marginTop: 0 }}>1. Personuppgiftsansvarig</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          [FÖRETAGSNAMN] är personuppgiftsansvarig för de uppgifter som behandlas i tjänsten.
          Kontakta oss på [E-POSTADRESS] vid frågor om dina personuppgifter.
        </p>

        <div className="cat-title">2. Vilka uppgifter vi samlar in</div>
        <p className="subhead" style={{ marginBottom: 8 }}>Vi behandlar följande uppgifter om dig som användare:</p>
        <ul className="subhead" style={{ marginBottom: 20, paddingLeft: 20 }}>
          <li><b style={{ color: 'var(--amber-glow)' }}>Kontouppgifter</b> — användarnamn och lösenord (lösenordet lagras
            aldrig i läsbar form, bara krypterat)</li>
          <li><b style={{ color: 'var(--amber-glow)' }}>Profiluppgifter</b> — profilbild om du väljer att ladda upp en,
            svårighetsgrad, om du angett att du är 12 år eller yngre</li>
          <li><b style={{ color: 'var(--amber-glow)' }}>Spelresultat</b> — vilka spel du spelat, resultat, tid och datum,
            kopplat till ditt konto</li>
          <li><b style={{ color: 'var(--amber-glow)' }}>Medlemskapsstatus</b> — vilken plan du har och till vilket datum
            den gäller. Vi lagrar aldrig kort- eller bankuppgifter — betalning sker via Swish,
            helt utanför vår tjänst, och vi ser bara att en betalning kommit in, inte några
            finansiella detaljer</li>
          <li><b style={{ color: 'var(--amber-glow)' }}>Liga- och familjemedlemskap</b> — vilka privata ligor och
            familjeplaner du är med i</li>
          <li><b style={{ color: 'var(--amber-glow)' }}>Meddelanden</b> — innehållet i frågor du skickar via
            "Kontakta oss" i din profil, samt våra svar</li>
          <li><b style={{ color: 'var(--amber-glow)' }}>Teknisk information</b> — IP-adress och liknande uppgifter som
            samlas in automatiskt av vår hosting- och databasleverantör för drift och säkerhet</li>
        </ul>

        <div className="cat-title">3. Varför vi behandlar uppgifterna</div>
        <p className="subhead" style={{ marginBottom: 8 }}>Vi behandlar dina uppgifter med stöd av följande rättsliga grunder:</p>
        <ul className="subhead" style={{ marginBottom: 20, paddingLeft: 20 }}>
          <li><b>Fullgörande av avtal</b> — för att kunna leverera tjänsten du skapat konto för,
            spara dina resultat och hantera ditt medlemskap</li>
          <li><b>Berättigat intresse</b> — för att förbättra tjänsten, upptäcka fel och förhindra
            missbruk</li>
          <li><b>Samtycke</b> — där du aktivt valt något, till exempel att ladda upp en profilbild
            eller ange att du är barn</li>
        </ul>

        <div className="cat-title">4. Barns uppgifter</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Kan Du Alla erbjuder Barnpaketet, där en förälder/vårdnadshavare skapar och betalar för
          ett konto åt sitt barn. Vi samlar in samma typ av uppgifter för barnkonton som för
          vanliga konton (användarnamn, spelresultat), men <b>ingen riktig e-postadress krävs
          eller lagras för barnet</b> — inloggningen bygger enbart på användarnamn och lösenord.
          Föräldern som skapat kontot kan se barnets spelstatistik och sätta nytt lösenord åt
          barnet, men har inte tillgång till barnets lösenord i klartext.
          <br /><br />
          <i>[Den här paragrafen behöver särskild juridisk uppmärksamhet. Enligt GDPR artikel 8,
          som Sverige implementerat med en åldersgräns på 13 år för samtycke till
          informationssamhällets tjänster, behöver ni sannolikt kunna visa att det är en förälder
          — inte barnet självt — som samtyckt till behandlingen. Er nuvarande lösning (föräldern
          skapar kontot åt barnet) ligger bra i linje med det, men en jurist bör bekräfta att
          flödet uppfyller kraven fullt ut.]</i>
        </p>

        <div className="cat-title">5. Hur länge vi sparar uppgifterna</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Vi sparar dina uppgifter så länge du har ett aktivt konto. Om du vill avsluta ditt
          konto och få dina uppgifter raderade, kontakta oss via "Kontakta oss" i din profil eller
          på [E-POSTADRESS]. Vissa uppgifter (t.ex. bokföringsunderlag för betalningar) kan behöva
          sparas längre om det krävs enligt lag.
        </p>

        <div className="cat-title">6. Vem vi delar uppgifter med</div>
        <p className="subhead" style={{ marginBottom: 8 }}>Vi säljer aldrig dina uppgifter. Vi använder följande underleverantörer
          (personuppgiftsbiträden) för att driva tjänsten:</p>
        <ul className="subhead" style={{ marginBottom: 20, paddingLeft: 20 }}>
          <li><b>Supabase</b> — databas och inloggning</li>
          <li><b>Vercel</b> — driftmiljö/hosting för själva webbplatsen</li>
          <li><b>Swish (Getswish AB)</b> — hanterar själva betalningstransaktionen; vi ser bara att
            en betalning kommit in, aldrig kort- eller kontouppgifter</li>
        </ul>
        <p className="subhead" style={{ marginBottom: 20 }}>
          <i>[Kontrollera var dessa leverantörers servrar finns (inom/utanför EU/EES) — om något
          sker utanför EU/EES kan det krävas extra skyddsåtgärder enligt GDPR, värt att en jurist
          tittar på.]</i>
        </p>

        <div className="cat-title">7. Dina rättigheter</div>
        <p className="subhead" style={{ marginBottom: 8 }}>Du har rätt att:</p>
        <ul className="subhead" style={{ marginBottom: 20, paddingLeft: 20 }}>
          <li>Få veta vilka uppgifter vi har om dig (registerutdrag)</li>
          <li>Få felaktiga uppgifter rättade</li>
          <li>Få dina uppgifter raderade ("rätten att bli glömd")</li>
          <li>Invända mot viss behandling eller begära att den begränsas</li>
          <li>Få ut dina uppgifter i ett strukturerat format (dataportabilitet)</li>
        </ul>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Kontakta oss på [E-POSTADRESS] för att utöva någon av rättigheterna ovan. Du har även
          rätt att klaga till Integritetsskyddsmyndigheten (IMY) om du anser att vi behandlar
          dina uppgifter felaktigt.
        </p>

        <div className="cat-title">8. Cookies och liknande tekniker</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Vi använder tekniskt nödvändiga cookies/lokal lagring för att hålla dig inloggad mellan
          besök. Vi använder inga marknadsförings- eller spårningscookies.
          <br /><br />
          <i>[Verifiera detta stämmer exakt med hur Supabase Auth hanterar sessioner hos er
          (cookies vs. localStorage) och komplettera om ni lägger till analysverktyg senare.]</i>
        </p>

        <div className="cat-title">9. Säkerhet</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Vi vidtar rimliga tekniska och organisatoriska åtgärder för att skydda dina uppgifter,
          bland annat kryptering av lösenord och begränsad åtkomst till känsliga uppgifter internt.
        </p>

        <div className="cat-title">10. Ändringar av policyn</div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          Vi kan uppdatera den här policyn. Väsentliga ändringar meddelas via e-post eller i
          tjänsten innan de träder i kraft.
        </p>

        <div className="cat-title">11. Kontakt</div>
        <p className="subhead" style={{ marginBottom: 0 }}>
          Frågor om hur vi hanterar dina personuppgifter? Kontakta oss på [E-POSTADRESS].
        </p>

      </div>
    </div>
  );
}
