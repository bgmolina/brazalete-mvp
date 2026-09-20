# Brazalete

Un espacio local de acompañamiento para familiares y cuidadores: frecuencia cardíaca, movimiento, pasos y eventos de una persona mayor. Incluye una demo independiente y conexión BLE real a una pulsera compatible.

**Es un prototipo orientativo, no un dispositivo médico ni un sistema de emergencias.** Una lectura de 0 BPM no confirma un paro cardíaco. Las posibles caídas requieren verificación presencial. No se envían notificaciones, mensajes ni llamadas.

## Iniciar en local

Requisitos: Node.js 22.12+ (o una versión LTS posterior), npm y Chrome/Edge de escritorio. Bluetooth habilitado para usar un dispositivo físico.

```bash
npm ci
npm run dev
```

Abrir [http://localhost:5173](http://localhost:5173). El servidor se limita a la interfaz local. Usuario y contraseña de ejemplo: **admin / admin**.

```dotenv
VITE_ADMIN_USERNAME=admin
VITE_ADMIN_PASSWORD=admin
```

`admin/admin` está definido como valor predeterminado en el código. Para cambiarlo, copiar `.env.example` a `.env.local`, editar ambos valores y reiniciar Vite. Las variables `VITE_*` son públicas en el código cliente: **no usar credenciales reales**. El login es una barrera de demostración, no una autenticación segura. La sesión vive en `sessionStorage`; no se guarda la contraseña.

## GitHub Pages

El sitio se publica en [bgmolina.github.io/brazalete-mvp](https://bgmolina.github.io/brazalete-mvp/) mediante GitHub Actions. El workflow valida tipos, lint y pruebas, compila Vite con base `/brazalete-mvp/` y publica exclusivamente `dist`.

```bash
npm run build:pages
npm run preview:pages
```

Las rutas alojadas usan hash, por ejemplo `/brazalete-mvp/#/demo`, para permitir navegación y recarga sin un servidor con fallback SPA. Las variables de repositorio opcionales `VITE_ADMIN_USERNAME` y `VITE_ADMIN_PASSWORD` pueden cambiar las credenciales durante el build; si están ausentes o vacías se usa `admin/admin`.

## Qué incluye

| Página               | Contenido                                                                               |
| -------------------- | --------------------------------------------------------------------------------------- |
| `/login`             | Acceso de prueba, validación accesible y control de visibilidad de contraseña.          |
| `/demo`              | Elena Martínez, perfil ficticio; historial de hasta 90 días y escenarios reproducibles. |
| `/monitoreo`         | Selección Bluetooth explícita, sensores disponibles y lecturas reales.                  |
| `/demo/alertas`      | Eventos simulados con filtros, detalles y revisión.                                     |
| `/monitoreo/alertas` | Eventos reales locales de las últimas 24 horas.                                         |
| `/configuracion`     | Ficha real, almacenamiento y perfiles GATT adicionales.                                 |

El panel muestra BPM, rango válido del período, movimiento, pasos de la sesión y hora de actualización. Contiene un gráfico de diez minutos, historial con promedio/rango y selección de intervalo, magnitud de aceleración y tabla X/Y/Z. No representa una señal ECG.

La demo permite reposo, movimiento, lectura cero, posible caída y desconexión, además de pausa y reinicio. El escenario de caída requiere aproximadamente trece segundos de ejecución continua. Los datos simulados no se guardan como telemetría real.

## Conectar una pulsera

1. Ir a **En vivo**. La ficha real comienza sin datos personales; se puede editar en Configuración.
2. Activar la pulsera y acercarla al equipo. Cerrar otras apps que puedan monopolizar su conexión.
3. Pulsar **Conectar pulsera** y elegir el dispositivo en el selector del navegador.
4. Revisar la sección de sensores: disponible, no compatible, sin datos o error.
5. Para movimiento/pasos, importar un perfil conocido en Configuración y volver a seleccionar la pulsera.

Se admite el servicio estándar Heart Rate `0x180D` con característica `0x2A37`, mediciones de 8/16 bits y contacto cuando el dispositivo lo informa. La batería es opcional y se lee al conectar. El identificador es el asignado por el navegador, no una MAC.

El H7 compatible con Veepoo Health también está soportado directamente: si no existe el servicio cardíaco estándar, la página detecta el servicio Veepoo, autentica con la clave predeterminada `0000`, lee la batería y queda lista para una medición manual. No necesita un perfil JSON ni la aplicación móvil como puente. Cerrá Veepoo Health y cualquier otra app que pueda ocupar el enlace antes de conectarlo. Aceleración, pasos y caídas del H7 permanecen como no compatibles hasta disponer de una señal documentada adecuada. Ver [perfiles BLE y compatibilidad](docs/perfiles-ble.md).

Con el H7 conectado y autenticado, el panel queda en **H7 listo para medir** sin activar automáticamente el sensor. **Medir frecuencia** inicia una única sesión con indicador de progreso y habilita inmediatamente **Detener medición**. El H7 continúa buscando y enviando pulso sin límite temporal hasta que la persona detiene la medición o termina la conexión. Durante el cierre y el breve período de espera el control permanece bloqueado para no enviar comandos simultáneos al brazalete.

Aunque el H7 ya esté emparejado en macOS, Chrome/Edge exige elegirlo desde **Conectar pulsera**: el emparejamiento del sistema no concede permiso Web Bluetooth ni ejecuta la autenticación y el comando de medición Veepoo.

La conexión se conserva al navegar por el panel, alertas y configuración. Se detiene al desconectar, pasar a demo o cerrar sesión. Ante una pérdida inesperada se intentan tres reconexiones, con esperas de 1, 2 y 4 segundos. Si se agotan, es necesario volver a conectar desde la interfaz.

## Datos y calidad

- Ausencia de lectura: `null`, nunca cero. Después de diez segundos sin pulso nuevo, el valor se conserva con su hora y se marca como desactualizado; el gráfico muestra un hueco.
- Estadísticas: sólo BPM positivos cuyo contacto no haya sido rechazado. Los ceros se conservan en contadores y eventos.
- Lectura cero: evento local inmediato “Lectura de 0 BPM: revisar medición”, con estado de contacto. Los ceros consecutivos forman un episodio; una recuperación, desconexión o interrupción de señal separa episodios.
- Pasos: incrementos de un contador acumulado. El primer valor es una base, no pasos realizados durante la sesión. Un reinicio o reconexión establece una nueva base.
- Caídas: inferencia experimental, habilitada únicamente con aceleración calibrada en g que incluya gravedad, frecuencia observada mínima de 20 Hz y continuidad suficiente. Impacto ≥ 2,5 g seguido de diez segundos con desviación estándar por eje ≤ 0,1 g; brechas mayores a 150 ms cancelan la evaluación. Separación mínima de sesenta segundos entre eventos. Parámetros en `src/shared/utils/detection.ts`.

## Almacenamiento

`localStorage` conserva exclusivamente los resúmenes por minuto y eventos reales de las últimas 24 horas, separados por dispositivo y con esquema versión 1 (`brazalete:v1:telemetry`). Se agrupan escrituras cada cinco segundos; los eventos se persisten inmediatamente.

La limpieza ocurre al abrir, leer/guardar y cada minuto mientras la app está abierta. La interfaz filtra los registros vencidos antes de mostrarlos. La limpieza manual solicita confirmación y elimina únicamente esta clave de telemetría; mantiene ficha, perfil BLE, demo y datos de otros sitios.

Las muestras detalladas permanecen en búferes limitados de memoria: hasta 6.000 puntos cardíacos dentro de diez minutos y 200 muestras de aceleración. No sobreviven a una recarga. Los resúmenes sí; una recarga no presenta el último BPM guardado como una lectura actual. La demo existe sólo en memoria.

La ficha y el perfil se guardan en `brazalete:v1:settings`, hasta que se editen o se borren los datos del sitio. La sesión de acceso usa `brazalete:session` en `sessionStorage`. No hay cifrado de almacenamiento ni sincronización entre navegadores/pestañas; usar una sola pestaña de monitoreo. Con datos corruptos o cuota agotada, se informa el problema y el monitoreo continúa en memoria.

**Cerrar el navegador o suspender la computadora interrumpe la recolección.** No hay servicio en segundo plano ni garantía de entrega o continuidad. El navegador puede limitar los temporizadores de pestañas inactivas; los cortes de señal no se interpretan como inmovilidad.

## Arquitectura

React 19 · TypeScript estricto · Vite 7 · Tailwind CSS 4 · shadcn/ui · Recharts · Lucide · React Router · Zustand · React Hook Form/Zod · Beacio 2.1.1 · Veepoo SDK 1.1.23.

```text
src/
  app/             composición, layout y ciclo de monitoreo
  auth/            páginas, hooks, rutas y sesión
  monitoring/      páginas, componentes, hooks, rutas y servicios BLE/demo
  settings/        páginas, hooks y rutas de configuración
  shared/          contratos, motor, persistencia, perfiles, detección y estado
  components/ui/   componentes instalados con el CLI de shadcn
  lib/             utilidades de componentes
```

El SDK oficial Veepoo está fijado al commit `f42ef8d3f1d71ebc3196a6a204c054325cc582e1` y se carga dinámicamente sólo al detectar su servicio propietario. La copia, licencia Apache-2.0, hash y procedencia están documentadas en `src/vendor/veepoo/`.

La organización toma como referencia los módulos del frontend Rico Antojo. Las páginas componen la interfaz; los hooks y servicios resuelven la lógica. Las rutas y los gráficos se cargan bajo demanda. El motor procesa las muestras fuera de React y publica una instantánea por segundo, salvo eventos/cambios de estado inmediatos.

La identidad usa Manrope alojada localmente, marfil, verde petróleo/salvia y acentos ámbar/coral. Las dos ilustraciones SVG son propias y editables. Las skills `frontend-design`, `shadcn-ui` y `vercel-react-best-practices` guiaron diseño, componentes accesibles y separación del procesamiento de alta frecuencia.

El [informe del sistema original](docs/analisis-brazalete.md) se utilizó sólo como referencia funcional. No hay llamadas a sus endpoints, SSE, MySQL o app Android.

## Comandos y pruebas

```bash
npm run typecheck
npm run lint
npm test
npm run test:coverage
npx playwright install chromium
npm run test:e2e
npm run test:e2e:pages
npm run build
npm run build:pages
npm run preview
npm run preview:pages
```

Los E2E usan credenciales de prueba `admin/admin` e inician Vite si no está abierto. Si se reutiliza un servidor con credenciales distintas, detenerlo antes de ejecutar las pruebas. `test:e2e:pages` compila y prueba la aplicación en `localhost:4173/brazalete-mvp/`, incluyendo recursos públicos y recarga de rutas. La previsualización de producción utiliza las variables incorporadas durante el build.

Vitest cubre decodificación, detección, agregados, retención, errores de almacenamiento, componentes e integración BLE con mocks oficiales. Playwright recorre login por teclado, demo/real, BLE simulado, navegación, persistencia, configuración, limpieza y vistas de 1440, 820 y 390 px, con verificaciones automáticas de accesibilidad en login y panel. Los informes se generan en `coverage/`, `playwright-report/` y `test-results/` (ignorados por Git).

La compatibilidad de **un modelo físico concreto queda pendiente** hasta realizar las [pruebas manuales de hardware](docs/pruebas-hardware.md). Las pruebas automáticas validan el comportamiento del software, no la precisión clínica ni el firmware de un reloj real.

## Fuentes técnicas

- [shadcn/ui Chart](https://ui.shadcn.com/docs/components/chart): gráficos basados en Recharts.
- [Vite: variables de entorno](https://vite.dev/guide/env-and-mode): exposición de variables `VITE_*`.
- [SDK Beacio](https://github.com/wklm/beacio-sdk): sucesor publicado del SDK consultado mediante Context7. Implementación contrastada con las declaraciones `.d.ts` y el código de `@beacio/core@2.1.1` / `@beacio/react@2.1.1` instalados.
- [Web Bluetooth](https://developer.chrome.com/docs/capabilities/bluetooth): selección desde una interacción del usuario y acceso a servicios GATT en contexto seguro.
- [SDK oficial Veepoo para mini-programas](https://github.com/HBandSDK/WeChat_Mini_Program_Ble_SDK): protocolo propietario usado por el H7 y transportado localmente sobre Web Bluetooth.

Se conserva la dependencia preexistente `@wklm/skill` como referencia; no se importa en la aplicación. No se utiliza ninguna API key de Beacio ni su infraestructura de notificaciones.
