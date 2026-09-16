# Informe técnico-funcional — Sistema Brazalete

## Síntesis

El sistema implementa un circuito de monitoreo de frecuencia cardíaca desde una pulsera inteligente Bluetooth hasta un panel web. La aplicación Android se conecta a la pulsera, obtiene lecturas de ritmo cardíaco y su estado de contacto, gestiona alertas locales y publica la telemetría. El backend persiste los datos y los expone al dashboard, que muestra el estado actual y tendencias históricas.

```text
Pulsera Bluetooth
       │ BLE (SDK Veepoo)
       ▼
Aplicación Android
       │ POST JSON
       ▼
API de ingesta PHP ──► MySQL (o SQLite local)
       │                         │
       └──────── SSE / API JSON ◄┘
                         │
                         ▼
                  Dashboard web
```

El repositorio de lectura contiene la aplicación Android. El segundo proyecto concentra el dashboard web, la API PHP y el esquema de base de datos.

## FrontEnd

### Aplicación Android de lectura

La aplicación está implementada en Kotlin con Jetpack Compose y Material 3. Su punto de entrada es una única actividad que inicia y se vincula a un servicio de monitoreo persistente.

Funcionalidades implementadas:

- Solicita permisos de Bluetooth, ubicación, notificaciones, superposición y servicio en primer plano según la versión de Android.
- Escanea dispositivos Bluetooth LE mediante el SDK Veepoo, toma el primer dispositivo encontrado y establece la conexión usando su dirección MAC.
- Autentica la pulsera, sincroniza un perfil de usuario y confirma visualmente la conexión mediante vibración del dispositivo.
- Permite configurar la URL de destino de la telemetría, conectar la pulsera, iniciar o detener la medición y ordenar la vibración manual de la pulsera.
- Muestra el último valor de BPM, la hora de la última lectura, el estado del sensor, un indicador visual de nueva lectura y un registro de actividad dentro de la pantalla.
- Incluye un interruptor para silenciar o habilitar el sonido de alarma y una animación perimetral cuando existe una alerta activa.

El `MonitoringService` es un servicio Android en primer plano de tipo `connectedDevice`. Conserva el monitoreo cuando la actividad no está en primer plano y publica el estado que consume la interfaz. Usa el listener de frecuencia cardíaca del SDK Veepoo para recibir valores y estados del sensor.

Ante un valor de frecuencia menor a 45 BPM, pérdida de contacto del sensor o falta de lecturas durante más de 15 segundos, el servicio activa el protocolo de alarma. Este genera tono local —si está habilitado—, actualiza la notificación de primer plano, intenta llevar la aplicación al frente, envía el nuevo estado al servidor y ejecuta una llamada HTTP preparada para una alerta de WhatsApp. Cuando el sensor vuelve a estado normal, la alarma se detiene y ese cambio también se publica.

La telemetría se envía con OkHttp en formato JSON. El mensaje producido por la aplicación incluye `device_mac`, `timestamp`, `heart_rate`, `alarm_active` y `status`.

Tecnologías y dependencias principales: Android SDK, Kotlin, Jetpack Compose, Material 3, SDK Veepoo y sus bibliotecas BLE incluidas como AAR/JAR, OkHttp y Gson. La configuración actual define `minSdk` 28 y `targetSdk` 37.

### Dashboard web

El dashboard es una aplicación web estática en HTML, CSS y JavaScript, con una interfaz en español y diseño de panel de monitoreo. Utiliza Chart.js cargado desde CDN para las visualizaciones.

Muestra las siguientes áreas:

- Reloj local y distintivo de conexión del último dispositivo reportado.
- Frecuencia cardíaca persistente, estado clínico textual calculado a partir del último BPM válido, estado de alarma y estado de contacto del sensor.
- Gráfico de lecturas individuales de los últimos 10 minutos.
- Gráfico de promedios por minuto de las últimas 24 horas.
- Gráfico de máximos y mínimos diarios de los últimos 7 días.

La actualización principal usa `EventSource` contra el endpoint SSE. El navegador conserva el último identificador de log, procesa solamente eventos nuevos y reconecta cuando el servidor cierra el flujo programadamente. Si el navegador no soporta SSE, el dashboard consulta la API de lectura cada dos segundos. Las consultas puntuales de tendencias descargan sólo las series históricas para no sobrecargar el flujo en vivo.

El gráfico ECG y su búfer de 500 muestras están definidos en el frontend, pero su tarjeta se mantiene oculta. Por lo tanto, la interfaz actualmente no presenta las muestras ECG almacenadas.

## Backend

### Persistencia y modelo de datos

El backend está escrito en PHP y accede a datos mediante PDO. Intenta conectarse a MySQL con UTF-8; si esa conexión no está disponible, inicializa una base SQLite local y crea sus tablas equivalentes.

El esquema MySQL define tres entidades:

| Entidad | Propósito | Datos principales |
| --- | --- | --- |
| `devices` | Registro del dispositivo que reporta. | MAC única, nombre, última vez visto y fecha de creación. |
| `health_logs` | Historial de telemetría. | BPM, alarma, estado del sensor, HRV/RR, batería y fecha de creación. |
| `ecg_waveform` | Muestras crudas de ECG opcionales. | MAC, arreglo JSON de muestras, frecuencia de muestreo y fecha. |

Las tablas de telemetría y ECG incluyen índices por MAC y fecha para las consultas temporales. El esquema de MySQL propone conservación de siete días de logs de salud y 24 horas de datos ECG; la limpieza operativa se implementa en un endpoint independiente.

### API

#### `POST backend/api/ingest.php`

Es el punto de entrada de telemetría de la aplicación móvil. Lee un cuerpo JSON, requiere una MAC válida y admite frecuencia cardíaca `0` o valores entre 30 y 250 BPM. Si el timestamp recibido se desvía más de cinco minutos, usa la hora del servidor.

Por cada mensaje realiza estas operaciones:

1. Crea o actualiza el dispositivo, incluyendo su última actividad.
2. Inserta un registro en `health_logs`.
3. Si se recibe `ecg_samples` como arreglo no vacío, serializa y guarda esa señal en `ecg_waveform`.

Además de los campos enviados por Android, el endpoint acepta de forma compatible `device_name`, `hrv_rr_ms`, `battery_level` y `ecg_samples`. Responde con el estado de la operación, el identificador del log y una marca temporal del servidor.

#### `GET backend/api/get_latest.php`

Obtiene el dispositivo con actividad más reciente. En su respuesta normal devuelve la identidad del dispositivo, la última telemetría, el último BPM no nulo y las tres series usadas por el dashboard: lecturas de diez minutos, promedio por minuto de 24 horas y máximos/mínimos diarios de siete días.

Con el parámetro `trends_only=1`, devuelve únicamente las tendencias de 24 horas y siete días. Este modo se usa para actualizar gráficos históricos sin repetir la consulta completa de datos en tiempo real.

#### `GET backend/api/sse.php`

Proporciona un stream Server-Sent Events para el dashboard. Consulta cada segundo el último log del dispositivo activo y emite un evento sólo cuando cambia su identificador. Cada evento incluye el estado actual y la serie de diez minutos; el primero de cada conexión añade las tendencias de 24 horas y siete días.

El endpoint manda mensajes de mantenimiento cuando no hay cambios y limita cada conexión a aproximadamente 55 segundos para permitir una reconexión limpia en hosting compartido. También admite la continuidad mediante `Last-Event-ID` o el parámetro `lastId`.

#### `backend/api/cleanup.php`

Es un endpoint pensado para ejecución programada por cron, por línea de comandos o por HTTP. Tras validar su token de ejecución, elimina registros de `health_logs` anteriores a siete días y datos de `ecg_waveform` anteriores a 24 horas. Devuelve o imprime la cantidad de registros eliminados y la hora de la tarea.

## Integración de extremo a extremo

1. La persona abre la app Android, concede permisos y conecta la pulsera BLE.
2. La app autentica y sincroniza la pulsera; al iniciar monitoreo, el servicio recibe mediciones de BPM y cambios de estado.
3. Cada lectura válida y cada transición de alarma se publica mediante JSON a `ingest.php`.
4. La API registra o actualiza el dispositivo, inserta el log de salud y opcionalmente guarda muestras ECG.
5. `sse.php` detecta el nuevo log y lo transmite al dashboard; éste refresca indicadores y el gráfico de los últimos diez minutos.
6. El dashboard obtiene las tendencias de 24 horas y siete días en la carga inicial o mediante consultas acotadas cuando cambian sus ventanas temporales.

## Capacidades presentes no expuestas actualmente

- El modelo y la API admiten almacenamiento de muestras ECG, pero la app Android actual no añade `ecg_samples` al payload de telemetría.
- El dashboard ya inicializa un gráfico ECG, aunque la tarjeta que lo contiene está ocultada en el HTML.
- El servicio Android contiene la integración HTTP para alertas de WhatsApp, con una URL de gateway y destinatario de ejemplo que deben ser configurados para producir el envío real.

## Verificación del relevamiento

El contenido de este informe fue contrastado de forma estática con el código Kotlin y el manifiesto Android, los archivos Gradle y el catálogo de versiones, el HTML/CSS/JavaScript del dashboard, los endpoints PHP, la configuración de conexión y el esquema SQL. La cobertura de pruebas del proyecto Android se limita a las pruebas de plantilla. No se ejecutó validación sintáctica de PHP porque el ejecutable PHP no está disponible en el entorno de análisis.
