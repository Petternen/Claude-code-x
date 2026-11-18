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
- **Lesing:** ordet vises uten bilde, barnet leser høyt, bildet avsløres ved riktig svar. Etter to bom leses ordet bokstav for bokstav. Ordlengde etter alder (2–5 bokstaver).
- **Butikk:** betal riktig beløp med mynter, tell pengene, «har jeg råd?» og vekslepenger (6 år). Mynter på 1, 5, 10 og 20 kr etter alder.
- **Huskespill:** finn like par (3–10 par etter alder).
- **Tegning:** pensel, fyll-bøtte, viskelær, stempler, angre, 6 fargeleggingsmaler og galleri per barn.
- **Skjermtid:** standard 10 min spill og 30 min pause for hele enheten, og figuren sover i pausen. Teller bare når appen er åpen.
  Voksenpassord (PBKDF2-hash, minst 8 tegn med bokstaver og tall) låser opp, gir +10 min og endrer tidene.
  Gjenopprettingskoden vises én gang og brukes hvis passordet glemmes.
- **Hjem i grupper:** Tall (Matte, Butikk), Bokstaver (Skriving, Lesing), Lek (Huskespill, Tegning) og Samling.
- **Nettbrett-oppsett (iPad liggende):** delt skjerm automatisk på brede skjermer.
  Matte: stor oppgave til venstre, barnets figur (jubler, blir lei seg, danser) med mikrofon til høyre.
  Skriving: stor tegneflate til venstre, eksempelbilde og hele alfabetet som tavle til høyre.
  Mobil og iPad stående beholder det enkle oppsettet.

## Tastatur
| Skjerm | Taster |
|---|---|
| Profiler | `1`–`9` velg, `N` ny |
| Hjem | `1` Tall, `2` Bokstaver, `3` Lek, `4` Samling · direkte: `M` Matte, `B` Butikk, `S` Skriving, `L` Lesing, `H` Huskespill, `T` Tegning, `C` Samling · `+`/`−` alder, `Esc` bytt spiller |
| Gruppe | `1`/`2` aktivitet, `Esc` hjem |
| Matte | `0–9` + `Enter` svar, `Mellomrom` hør igjen, `Esc` hjem |
| Skriving | `←`/`→` forrige/neste, bokstav/tall-tast hopp direkte, `Tab` bytt fane, `Mellomrom` hør, `Backspace` start på nytt |
| Lesing | `Mellomrom` les sammen, `Enter` voksen godkjenner |
| Butikk | Mynter `1` `5` `0`(10) `2`(20), `Backspace` ta tilbake · `J`/`N` ja/nei · tall + `Enter` |
| Huskespill | Piltaster + `Enter` |
| Tegning | `1`–`0` farger, `[` `]` størrelse, `B` pensel, `F` fyll, `E` viskelær, `T` stempel, `U` angre, `M` maler, `G` galleri, `S` lagre |
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
npm run test:unit   # 60 enhetstester (<1 s)
npm run test:e2e    # 103 nettlesertester med simulert tale og fingertegning
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
| `tests/unit/features.test.mjs` | Lesing, butikk, huskespill, fyll-algoritme, passord/hash |
| `tests/e2e/features.test.mjs` | Grupper, Lesing, Butikk, Huskespill, Tegning og galleri |
| `tests/e2e/screentime.test.mjs` | Pause, låst enhet, passord, gjenopprettingskode, +10 min, innstillinger |
| `tests/e2e/tablet.test.mjs` | iPad mini/Air/Pro liggende, figurens reaksjoner, snu nettbrettet |
| `tests/e2e/layout-pwa.test.mjs` | 5 skjermstørrelser, manifest, service worker, offline, tilgjengelighet |

Testene kjøres automatisk på hver PR (`.github/workflows/tests.yml`).
