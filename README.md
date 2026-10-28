# CertQuiz

PWA para practicar exámenes de certificación (Microsoft, AWS, Google…) con preguntas de opción múltiple.
Solo frontend (HTML + CSS + JS vanilla con módulos ES), sin build, sin dependencias y 100 % offline tras la primera carga.
Los datos del estudiante (historial, favoritas, ajustes, bancos subidos) se guardan solo en el navegador.

## Ejecutar en local

Hace falta un servidor HTTP (los módulos ES y el service worker no funcionan con `file://`):

```bash
npx serve .
# o
python3 -m http.server 8080
```

Abre `http://localhost:8080/` (o el puerto indicado).

## Estructura

```
index.html  manifest.json  sw.js
css/        main.css (tokens, temas) · components.css
js/app.js   arranque, enrutado (hash) y controladores
js/core/    EventBus (Observer)
js/banks/   BankValidator, QuestionBank (modelo), BankRepository
js/engine/  Evaluator (Strategy), TestBuilder, ExamSession
js/storage/ StorageAdapter (localStorage + IndexedDB), HistoryManager
js/ui/      Render (barrel), vistas, componentes, Charts (SVG propio)
dumps/      index.json + bancos .json
icons/  fonts/  (fuentes locales, sin CDN)
```

## Añadir un banco

1. Copia el archivo (formato `schema_version: "1.0"`) a `/dumps/`, p. ej. `dumps/az104.json`.
2. Añádelo a `dumps/index.json`:
   `{ "file": "az104.json", "name": "Azure Administrator (AZ-104)", "provider": "Microsoft" }`
3. Añádelo a la constante `PRECACHE` de `sw.js` (`'./dumps/az104.json'`).
4. Sube la versión de `CACHE_NAME` en `sw.js` (p. ej. `CertQuiz-v2`) para que los clientes actualicen la caché.

También se pueden subir bancos desde la propia app (Inicio → «Añadir banco»): se validan y se guardan en IndexedDB.

## Desplegar

Todas las rutas son relativas, así que funciona en la raíz o en subrutas (`usuario.github.io/repo/`).

- **GitHub Pages**: sube el contenido de esta carpeta a un repositorio → Settings → Pages → «Deploy from a branch» → rama `main`, carpeta `/` (root).
- **Vercel**: `vercel deploy` desde esta carpeta (framework «Other», sin comando de build, output = raíz).

## Código fuente descargable

`files.zip` (raíz pública) contiene todo el proyecto. Regenéralo con `./build-zip.sh` (bash) o `./build-zip.ps1` (PowerShell).
El service worker nunca cachea `files.zip`.
# CertQuiz
