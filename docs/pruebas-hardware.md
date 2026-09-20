# Verificación y pruebas de hardware

## Qué acreditan las pruebas automáticas

Las pruebas unitarias y de componentes verifican la lógica y los estados de la interfaz. La integración BLE utiliza `@beacio/core/testing`: selección de protocolo estándar/Veepoo, autenticación H7, batería, recepción, desconexión, tres reintentos y cancelación de suscripciones bajo React StrictMode. Los E2E recorren ambos protocolos simulados en Chromium.

El mock publicado en Beacio 2.1.1 emite notificaciones con un `event.target` sintético que no conserva la identidad de la característica; el núcleo del SDK exige la identidad que garantiza el navegador. `tests/helpers/mockNotifications.ts` normaliza únicamente ese comportamiento del mock. No modifica producción ni evita ejecutar el decodificador, motor o flujo GATT del SDK.

`tests/e2e/ble-fixture.ts` se carga explícitamente desde las pruebas usando Vite. No es importado por la aplicación ni se incluye en el build de producción. Las pruebas BLE simuladas no prueban un chip Bluetooth, permisos de un sistema operativo real o un firmware comercial.

## Registro de equipo físico

Completar para cada modelo antes de declarar compatibilidad:

- Fabricante, modelo, firmware y nombre anunciado.
- Sistema operativo, versión de Chrome/Edge y adaptador Bluetooth del equipo.
- UUID y propiedades de los servicios/ características observados.
- Perfil JSON utilizado, unidades, calibración y tasa de notificaciones medida.
- Fecha, persona que realizó la prueba y resultado de cada paso siguiente.

**Estado actual: pendiente de prueba con una pulsera física concreta.**

## Recorrido manual seguro

1. Abrir `localhost:5173`, ingresar y pasar a En vivo. Verificar que no aparezcan valores ficticios ni datos personales de la demo.
2. Cancelar el selector: se debe volver al estado sin conexión, permitiendo intentarlo nuevamente.
3. Elegir la pulsera. Verificar nombre/ID del navegador y sensores independientes. Si falta Heart Rate estándar, debe intentarse Veepoo antes de mostrar “No compatible”.
4. Comparar las lecturas cardíacas con las publicadas por el propio dispositivo; registrar latencia, contacto informado y frecuencia observada. Esto no acredita precisión médica.
5. Navegar entre panel, alertas y configuración sin perder la conexión. Editar la ficha y comprobar que se mantiene el flujo.
6. Interrumpir la comunicación de forma controlada. Verificar evento de desconexión, valor desactualizado y hasta tres reconexiones con espera progresiva. La pérdida de señal no debe convertirse en cero ni en caída.
7. Si existe un perfil documentado, validar X/Y/Z en g y orientación de reposo. Confirmar que el contador de pasos muestra sólo incrementos desde la conexión, no todos los pasos históricos del reloj.
8. Verificar que “Detección experimental activa” aparece únicamente con calibración/gravedad confirmadas y tasa continua suficiente. **No provocar caídas de una persona ni situaciones de riesgo.** Usar un montaje de ensayo o la demo para simular impacto/inmovilidad.
9. Para un cero reportado durante un ensayo controlado, comprobar un único evento por episodio y evidencia de contacto. No intentar inducir un problema cardíaco. La demo permite probar esta interfaz sin ninguna exposición física.
10. Recargar: se deben conservar los agregados y eventos vigentes, pero no las muestras detalladas ni un BPM presentado como actual. Volver a conectar manualmente.
11. Pasar a demo, desconectar y cerrar sesión, por separado. Verificar que cesan las suscripciones reales en cada caso.
12. Probar limpieza cancelada/confirmada y comprobar que no se alteran ficha ni perfil. No cambiar el reloj del sistema durante un monitoreo de una persona; ensayar retención con datos ficticios o tests automatizados.

## Recorrido específico H7/Veepoo

1. Confirmar que el modelo funciona con Veepoo Health, anotar firmware y cerrar por completo esa aplicación y cualquier otra que mantenga el H7 ocupado.
2. Aunque figure emparejado en macOS, pulsar **Conectar pulsera** y elegir H7 en el diálogo protegido de Chrome/Edge.
3. Comprobar la secuencia visible “Reconociendo sensores” → “Autenticando H7” → “H7 listo para medir”, el rótulo “Protocolo H7/Veepoo” y la batería. La conexión no debe iniciar el sensor cardíaco.
4. Pulsar **Medir frecuencia** y comprobar “Preparando sensor” → “Midiendo en vivo”; mantenerla activa varios minutos, comparar lecturas con la pantalla del reloj sin atribuir precisión médica y confirmar que no se detiene por tiempo. Pulsar **Detener medición** y esperar que el control vuelva a quedar disponible.
5. Aflojar o retirar el brazalete de forma segura: debe informarse falta de contacto, sin 0 BPM ni evento clínico. Si el reloj está midiendo otra función, debe aparecer el error de dispositivo ocupado.
6. Repetir tres ciclos de inicio y detención sin `deviceBusy` originado por la página. Luego interrumpir el enlace y comprobar reconexión sin lecturas, listeners ni comandos duplicados.
7. Pulsar Desconectar, pasar a demo y cerrar sesión en ensayos separados. Confirmar que la medición se detiene en el reloj y que no llegan más muestras.
8. Revisar consola y estado GATT sólo durante el ensayo. No conservar identificadores ni volcados de paquetes sensibles.

La validación física requiere seleccionar el dispositivo en un diálogo del navegador y observar el firmware real; no puede sustituirse por el mock automatizado. Hasta completar y registrar este recorrido, “soportado” describe la implementación del protocolo, no una certificación de ese ejemplar o firmware.

## Revisión visual y accesibilidad

Las pruebas Playwright verifican login y dashboard con axe (WCAG 2 A/AA y 2.1 AA), capturan login/panel/alertas/configuración en anchos de 1440, 820 y 390 px y comprueban que no haya desbordamiento horizontal. Hay validación de login por teclado, foco visible y navegación móvil con Escape y contención de foco.

Las capturas se guardan en `test-results/` y los reportes HTML en `playwright-report/`. Son artefactos generados, no archivos de datos del paciente. El análisis automático de accesibilidad no sustituye una revisión manual con teclado y lector de pantalla.

## Límites operativos

- Sólo una persona/pulsera activa y una pestaña de monitoreo. No hay coordinación de escrituras entre pestañas.
- Sin recepción con el navegador cerrado o la PC suspendida; no hay garantía de ejecución continua en segundo plano.
- Sin envíos externos, servicio de emergencias, backend, sincronización en la nube ni historial real mayor a 24 horas.
- Login local de demostración; cualquier persona con acceso al navegador puede inspeccionar sus datos y código.
- Posibles caídas y lecturas cero son señales para revisar, no diagnósticos. El sistema no puede confirmar ni descartar un paro cardíaco.
