<div align="center">

<img src="icons/icon.svg" alt="Logo de CertQuiz" width="96" height="96">

# CertQuiz

**Practica tus certificaciones con bancos de preguntas hechos y compartidos por la comunidad.**

Sin servidor · Sin cuentas · Funciona sin conexión · Tus datos se quedan en tu navegador

[![Código: MIT](https://img.shields.io/badge/c%C3%B3digo-MIT-blue?style=flat-square)](LICENSE)
[![Bancos: CC BY 4.0](https://img.shields.io/badge/bancos-CC%20BY%204.0-lightgrey?style=flat-square)](dumps/LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](#-contribuir)
[![PWA](https://img.shields.io/badge/PWA-offline--first-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](#-sin-conexión-pwa)
[![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](#-arquitectura)
[![Dependencias](https://img.shields.io/badge/dependencias-0-success?style=flat-square)](#-arquitectura)
[![Estrellas](https://img.shields.io/github/stars/TU-USUARIO/TU-REPO?style=flat-square)](https://github.com/TU-USUARIO/TU-REPO/stargazers)
[![Contribuidores](https://img.shields.io/github/contributors/TU-USUARIO/TU-REPO?style=flat-square)](https://github.com/TU-USUARIO/TU-REPO/graphs/contributors)

[🌐 Demo](https://TU-USUARIO.github.io/TU-REPO/) · [🚀 Inicio rápido](#-inicio-rápido) · [📚 Bancos](#-bancos-de-preguntas) · [🤝 Contribuir](#-contribuir) · [🐛 Reportar un problema](https://github.com/TU-USUARIO/TU-REPO/issues)

</div>

<!-- ![Captura de pantalla](docs/screenshot.png) -->

---

## ✨ Características

- 📚 **Bancos en JSON**: elige uno de la carpeta `dumps/` o sube el tuyo (arrastrar y soltar). Se validan al cargar y los errores indican la ruta exacta del problema.
- ⚙️ **Test configurable**: cantidad de preguntas (50 por defecto), filtro por dominio, selección aleatoria sin repetición y orden aleatorio de opciones.
- 🎯 **Varios modos**: test normal, solo falladas, dominio más débil, favoritas ⭐ y modo simulacro (sin feedback hasta el final, con tiempo límite opcional).
- ✅ **Feedback inmediato**: correctas en verde, incorrectas en rojo, veredicto, explicación y referencias.
- 🧮 **Evaluación estricta**: en preguntas de varias respuestas solo es correcta la coincidencia exacta.
- ⏯️ **Reanudación**: si cierras el navegador a mitad de un test, continúas en la misma pregunta y con el tiempo acumulado.
- 📈 **Historial y estadísticas**: evolución del % de acierto y desglose por dominio, con gráficos SVG propios.
- 💾 **Exportar / importar progreso** en JSON para cambiar de dispositivo.
- 🌗 **Tema claro y oscuro**, responsive, accesible y con atajos de teclado.
- 📲 **Instalable** en Android, iOS, Windows y macOS.
- 🔒 **Privacidad total**: ningún dato sale de tu navegador.

## 🚀 Inicio rápido

Necesitas un servidor estático local (los módulos ES y el service worker no funcionan abriendo `index.html` con `file://`).

```bash
git clone https://github.com/juanpfrancos/CertQuiz.git
cd CertQuiz
npx serve .
# alternativa: python3 -m http.server 8080
```

Abre la dirección que indique el comando. No hay dependencias ni paso de build.

## 🎮 Cómo se usa

1. En **Inicio**, elige un banco: verás su nombre, proveedor, código de examen y las preguntas por dominio.
2. Configura el test (cantidad, dominios, modo) y pulsa **Comenzar**.
3. Responde, pulsa **Comprobar respuesta** y revisa la explicación. Al final verás tu puntaje, el desglose por dominio y las preguntas falladas.
4. En **Historial** consulta tu evolución y exporta o importa tu progreso.

### ⌨️ Atajos de teclado

| Tecla | Acción |
|---|---|
| `1`–`9` o `A`–`F` | Selecciona (o alterna) la opción en esa posición |
| `Enter` | Comprueba la respuesta o pasa a la siguiente |
| `Esc` | Cierra el diálogo abierto |
| `?` | Muestra la ayuda de atajos |

## 📚 Bancos de preguntas

| Proveedor | Certificación | Idioma | Preguntas | Archivo |
|---|---|---|---|---|
| Microsoft | Fabric Data Engineer (DP-700) | 🇪🇸 es | 65 | [`dumps/dp700.json`](dumps/dp700.json) |

> [!NOTE]
> La lista completa y actualizada está en [`dumps/index.json`](dumps/index.json) y dentro de la app. Esta tabla se actualiza al aceptar nuevos bancos.

### 🧩 Formato del banco (`schema_version: "1.0"`)

<details>
<summary><b>Ver estructura completa y reglas</b></summary>

```json
{
  "schema_version": "1.0",
  "certification": {
    "id": "microsoft-dp-700",
    "name": "Microsoft Fabric Data Engineer",
    "exam_code": "DP-700",
    "provider": "Microsoft",
    "language": "es"
  },
  "domains": [
    {
      "id": "domain-01",
      "name": "Implementar y administrar una solución de análisis",
      "questions": [
        {
          "id": "DP700-Q024",
          "type": "single_choice",
          "question": "Texto del enunciado.\nSe respetan los saltos de línea.",
          "options": [
            { "id": "A", "text": "Opción A" },
            { "id": "B", "text": "Opción B" }
          ],
          "correct_answers": ["B"],
          "explanation": "Por qué B es correcta y las demás no.",
          "references": [
            { "title": "Dominios de Fabric | Microsoft Learn", "url": "https://learn.microsoft.com/..." }
          ]
        }
      ]
    }
  ]
}
```

| Campo | Reglas |
|---|---|
| `certification.id` | Único para toda la app (historial y favoritas dependen de él). Formato `proveedor-codigo` en minúsculas. Si ya existe esa certificación en otro idioma, añade el sufijo del idioma (`aws-saa-c03-en`). |
| `certification.language` | `es`, `en`, `pt-BR`… |
| `domains[].id` | `domain-01`, `domain-02`… Cada pregunta pertenece a un solo dominio. |
| `type` | `single_choice` (exactamente 1 correcta) o `multiple_choice` (2 o más). |
| `options[].id` | Letras mayúsculas (A, B, C…), únicas dentro de la pregunta. Mínimo 2 opciones. |
| `correct_answers` | Ids que existen en `options`; nunca todas las opciones. |
| `question.id` | Único dentro del banco. Formato recomendado: `CODIGO-Q001`. |
| `explanation` | Obligatoria. Explica por qué la respuesta es correcta y, si puedes, por qué las demás no. |
| `references` | Opcional. Lista de `{title, url?}`. Si hay `url`, debe ser `http(s)`. |

La app rechaza el banco si falta un campo obligatorio, si `schema_version` no es `"1.0"` o si se incumple alguna regla anterior, y muestra todos los errores con su ruta.

</details>

## 🤝 Contribuir

CertQuiz es un proyecto colaborativo: **cualquiera puede añadir su banco de preguntas** para una certificación de Microsoft, AWS, Google, Cisco, Oracle, CompTIA o la que quieras. No necesitas programar, solo crear un archivo JSON.

### 📥 Añadir un banco en 5 pasos

1. **Haz un fork** del repositorio y crea una rama: `git checkout -b banco-aws-clf-c02`.
2. **Crea tu archivo** en `dumps/`, con nombre en minúsculas y sin espacios (por ejemplo `aws-clf-c02.json`), siguiendo el [formato](#-formato-del-banco-schema_version-10).
3. **Regístralo** añadiendo una entrada en [`dumps/index.json`](dumps/index.json):
   ```json
   { "file": "aws-clf-c02.json", "name": "AWS Certified Cloud Practitioner (CLF-C02)", "provider": "AWS" }
   ```
4. **Pruébalo**: levanta la app (`npx serve .`) y comprueba que carga y se puede practicar. También puedes subirlo con el botón *Subir banco*: la validación te mostrará cualquier error con su ruta exacta.
5. **Abre un Pull Request** indicando la certificación, el idioma, el número de preguntas y de dónde salen.

> [!TIP]
> Si dos PRs modifican `dumps/index.json` a la vez puede aparecer un conflicto. Resuélvelo conservando **ambas** entradas.

### ✅ Antes de enviar tu PR

- [ ] El banco carga en la app sin errores.
- [ ] `certification.id` no se repite con ningún otro banco.
- [ ] Todas las preguntas tienen explicación y la respuesta correcta está verificada.
- [ ] Los dominios siguen la guía oficial del examen.
- [ ] Aceptas publicar tu banco bajo la licencia [CC BY 4.0](dumps/LICENSE).
- [ ] Las referencias (si las hay) son enlaces `https://` reales.
- [ ] Revisaste ortografía y que no haya preguntas duplicadas.

> [!IMPORTANT]
> **Solo contenido original o con permiso.** No se aceptan preguntas copiadas de exámenes reales ni de *brain dumps*: violan los acuerdos de confidencialidad de los proveedores y ponen en riesgo el proyecto. Escribe tus propias preguntas basándote en la documentación oficial, o usa material que tengas permiso de publicar e indica su origen en el PR.

### 🛠️ Otras formas de ayudar

- ✏️ **Corregir preguntas**: ¿una respuesta o explicación está mal? Abre un [issue](https://github.com/TU-USUARIO/TU-REPO/issues) con el ID de la pregunta y, si puedes, la fuente oficial.
- 🌍 **Traducir bancos** a otros idiomas (con su propio `certification.id`).
- 🐞 **Reportar errores** de la app indicando navegador y dispositivo.
- ♿ **Mejorar accesibilidad**, probar en iOS/Android o proponer mejoras de interfaz.

### 💻 Contribuir con código

1. Mantén el código modular (ES modules) y **sin dependencias externas**.
2. Inserta siempre los textos de los bancos con `textContent`, nunca con `innerHTML`.
3. Si tocas el service worker, prueba la app sin conexión.
4. Describe el cambio en el PR.
5. Tu código se publicará bajo la licencia [MIT](LICENSE).

### 👥 Contribuidores

<a href="https://github.com/juanpfrancos/CertQuiz/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=juanpfrancos/CertQuiz" alt="Contribuidores de CertQuiz">
</a>

## 🔒 Almacenamiento y privacidad

Todo se guarda localmente en tu navegador. No hay servidor, analítica ni peticiones a terceros.

| Dónde | Qué |
|---|---|
| `localStorage` (`cq:v1:*`) | Ajustes, tema, favoritas y test en curso |
| IndexedDB (`cq-v1`) | Historial de intentos, estadísticas por pregunta y bancos subidos |
| Cache Storage | Archivos de la app y bancos para uso sin conexión |

### 🧹 Restablecer

En **Ajustes → Peligro**:

- **Borrar solo historial**: elimina intentos, estadísticas y el test en curso. Conserva ajustes, bancos subidos y favoritas.
- **Restablecer aplicación**: borra `localStorage` (solo claves `cq:`), IndexedDB, Cache Storage y desregistra el service worker. La app vuelve a su estado inicial tras recargar. Requiere confirmación en dos pasos.

## 📴 Sin conexión (PWA)

Tras la primera visita, el service worker guarda la aplicación y los bancos de `dumps/index.json`, y puedes practicar sin conexión. El archivo `dumps/index.json` se consulta primero en red para detectar bancos nuevos y usa la caché si no hay conexión.

## 🏗️ Arquitectura

Tres capas desacopladas: **UI** (presentación), **Engine** (lógica de evaluación) y **Storage** (acceso a datos).

```
/
├── index.html
├── manifest.json
├── sw.js
├── icons/
├── css/
│   ├── main.css            # variables y temas claro/oscuro
│   └── components.css      # componentes de interfaz
├── js/
│   ├── app.js              # arranque y controladores
│   ├── core/EventBus.js    # pub/sub (Observer)
│   ├── banks/              # BankValidator, BankRepository
│   ├── engine/             # Evaluator (Strategy), TestBuilder, ExamSession
│   ├── storage/            # StorageAdapter, HistoryManager
│   └── ui/                 # Render, Charts
└── dumps/                  # bancos de preguntas + index.json
```

| Patrón | Dónde | Para qué |
|---|---|---|
| Observer | `EventBus` | La UI se actualiza al cambiar el estado del examen sin repintar todo el DOM |
| Strategy | `Evaluator` | Cada tipo de pregunta tiene su regla de evaluación; añadir uno nuevo no toca el motor |
| Repository / Adapter | `StorageAdapter` | Oculta localStorage e IndexedDB al resto de la aplicación |
| Cache-first | `sw.js` | Funcionamiento sin conexión |

## ☁️ Despliegue

Es un sitio 100% estático con rutas relativas, así que funciona en la raíz de un dominio o en una subruta.

- **GitHub Pages**: Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`.
- **Vercel / Netlify**: importa el repositorio, sin framework, sin comando de build y con la raíz como directorio de salida.

> [!NOTE]
> Al publicar cambios en la app, incrementa `CACHE_NAME` en `sw.js` para que los usuarios reciban la versión nueva.

## 🌐 Navegadores compatibles

Versiones recientes de Chrome, Edge, Firefox y Safari. La instalación como app depende del navegador (en iOS: Compartir → *Añadir a pantalla de inicio*).

## ⚖️ Aviso legal

CertQuiz es una herramienta independiente y no está afiliada ni respaldada por Microsoft, AWS, Google u otros proveedores de certificaciones. Los nombres de certificaciones y marcas pertenecen a sus respectivos propietarios. Las preguntas son material de práctica; quien aporta un banco es responsable de tener derecho a publicar su contenido.

## 📄 Licencia

Este proyecto usa dos licencias, una para el código y otra para el contenido:

| Qué | Licencia | Archivo |
|---|---|---|
| 💻 Código (HTML, CSS, JavaScript, service worker…) | [MIT](https://opensource.org/licenses/MIT) | [`LICENSE`](LICENSE) |
| 📚 Bancos de preguntas (`dumps/`) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es) | [`dumps/LICENSE`](dumps/LICENSE) |

- Puedes usar, copiar y modificar el código libremente, conservando el aviso de copyright.
- Puedes reutilizar los bancos, incluso con fines comerciales, siempre que des crédito a CertQuiz y a quienes los crearon.
- Al contribuir aceptas que tu código se publique bajo MIT y tu banco bajo CC BY 4.0.

---

<div align="center">

Hecho con ❤️ · Si te sirve, dale una ⭐ al repo

</div>