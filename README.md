# ⭐ Stjerneskolen

Matte og skriving for barn 3–6 år. Ren web-app (PWA) – ingen bygging, virker offline og kan installeres på nettbrett.

## Funksjoner
- **7 alderstrinn** (3, 3½, 4, 4½, 5, 5½, 6 år) styrer tallområde, oppgavetyper og hvor presist man må spore bokstaver.
- **Matte med tale:** oppgaven vises og leses opp. Barnet svarer med stemmen (norsk talegjenkjenning).
  Oppgavetyper: telling, pluss, minus, størst/minst, før/etter og tallrekker.
  Skjult reserve for voksne: tast svaret + `Enter`.
- **Skriving med fingeren:** store bokstaver A–Å, tall 0–9, korte ord og barnets eget navn.
  Omriss, nummerert grønt startpunkt, retningspiler og en demo-prikk som viser bevegelsen.
- **Nivå 1–60** med eksponentiell XP-kurve (`60 · 1,08^(nivå−1)`), ca. 6 måneder til nivå 60 ved 15 min/dag.
  Hvert nivå gir en skatt: 47 matteskatter + 12 utstyr til figuren (hatt, venn, glød hvert 5. nivå).
- **Flere profiler** lagret lokalt på enheten (localStorage).

## Tastatur
| Skjerm | Taster |
|---|---|
| Profiler | `1`–`9` velg, `N` ny |
| Hjem | `1` Matte, `2` Skriving, `3` Samling, `+`/`−` alder, `Esc` bytt spiller |
| Matte | `0–9` + `Enter` svar, `Mellomrom` hør igjen, `Esc` hjem |
| Skriving | `←`/`→` forrige/neste, bokstav/tall-tast hopp direkte, `Tab` bytt fane, `Mellomrom` hør, `Backspace` start på nytt |
| Nivå opp | `Enter` |

## Nettlesere
Talegjenkjenning krever **Chrome** (Android/PC) eller **Safari** (iPad/iPhone, iOS 14.5+). Firefox støtter det ikke.
Mikrofon krever HTTPS – GitHub Pages gir det automatisk.

## Publisering (GitHub Pages)
1. Repo → **Settings → Pages → Source: GitHub Actions**.
2. Merge til `main` – workflowen `.github/workflows/pages.yml` publiserer mappen `app/`.

## Lokal kjøring
```sh
cd app && python3 -m http.server 8000   # åpne http://localhost:8000
```

## Tester
```sh
npm install && npx playwright install chromium   # første gang
npm test            # alt (≈3 min)
npm run test:unit   # 35 enhetstester (<1 s)
npm run test:e2e    # 57 nettlesertester med simulert tale og fingertegning
```
| Fil | Dekker |
|---|---|
| `tests/unit/speech.test.mjs` | Norske tallord (0–100, *syv/sju*, *fem og tjue*), bedømming av tale |
| `tests/unit/state.test.mjs` | XP-kurve, nivåhopp, maks nivå 60 |
| `tests/unit/data.test.mjs` | Alderstrinn, bokstavmaler, ord, 59 skatter, sjeldenhet |
| `tests/unit/math.test.mjs` | 4 000 oppgaver per alder: riktige svar, tallområder, bildestøtte |
| `tests/e2e/math.test.mjs` | Tale (riktig/feil/stillhet/blokkert/ikke støttet), tastatur, rekke-bonus, runde, nivå opp, aldersgating |
| `tests/e2e/write.test.mjs` | Alle 39 tegn sporbare, feil start/retning/rekkefølge, juks på O, presisjon per alder, ord og navn |
| `tests/e2e/app.test.mjs` | Profiler, hjem, samling og utstyr, sletting, ødelagt lagring, HTML-injeksjon |
| `tests/e2e/layout-pwa.test.mjs` | 5 skjermstørrelser, manifest, service worker, offline, tilgjengelighet |

Testene kjøres automatisk på hver PR (`.github/workflows/tests.yml`).
