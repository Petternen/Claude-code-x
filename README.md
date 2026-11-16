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
