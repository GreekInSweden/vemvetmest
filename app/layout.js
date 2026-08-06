import './globals.css';

export const metadata = {
  title: 'Kan Du Alla — gissa hela tabellen',
  description: 'Skriv och gissa dig igenom ranglistor inom sport, geografi, historia och mer.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="sv">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
