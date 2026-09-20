# Perfiles Bluetooth y compatibilidad

## Alcance real

Este frontend se conecta directamente desde Chrome/Edge de escritorio a un periférico BLE. No utiliza la aplicación Android original como puente. Que un reloj tenga sensor cardíaco, acelerómetro o podómetro no implica que exponga sus datos a Web Bluetooth.

| Capacidad           | Implementación                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Frecuencia cardíaca | Heart Rate estándar `0x180D/0x2A37`; como alternativa, sesión propietaria H7/Veepoo autenticada.                          |
| Contacto            | Flags del paquete Heart Rate; puede ser no informado.                                                             |
| Batería             | Battery Service estándar `0x180F/0x2A19` o evento Veepoo `type: 2`.                                                |
| Identidad           | ID y nombre expuestos por el navegador, sin dirección MAC.                                                        |
| Acelerómetro        | Perfil JSON adicional; tres campos numéricos en una característica notificable.                                   |
| Pasos               | Perfil JSON adicional; un campo con contador acumulado entero no negativo.                                        |
| Caídas              | Inferencia local experimental sólo cuando la calidad de aceleración permite evaluarla.                            |

Un dispositivo puede ofrecer pulso sin movimiento; esos sensores se muestran por separado. Los servicios no disponibles no se reemplazan con datos ficticios. Una suscripción activa que todavía no notificó queda “Sin datos”. Un paquete inválido queda “Error de lectura”; un paquete válido posterior permite recuperar el estado.

## Importación

1. Obtener documentación GATT del fabricante: UUID de servicio y característica, propiedades `notify`/`indicate`, formato binario, unidades y frecuencia.
2. Descargar `public/profiles/perfil-ejemplo.json` desde Configuración.
3. Reemplazar UUID, offsets, tipos, orden de bytes y escalas con los valores documentados. La plantilla **no es un perfil funcional de ningún modelo comercial**.
4. Importar el archivo (máximo 32 KB) o pegar el JSON; pulsar **Validar y aplicar perfil**.
5. Volver a conectar. El selector debe autorizar los servicios nuevos, incluidos en `optionalServices`.

Guardar el perfil desconecta la pulsera actual. Editar solamente la ficha personal no modifica las suscripciones. Quitar el perfil deja disponibles únicamente los servicios estándar.

## Contrato JSON

La plantilla completa se encuentra en [perfil-ejemplo.json](../public/profiles/perfil-ejemplo.json). Se requiere `version: 1`, un `name` de hasta 80 caracteres y al menos una de las propiedades `acceleration` o `steps`. Los UUID son cadenas completas de 128 bits. Cada sensor especifica `service` y `characteristic`.

Cada campo numérico contiene:

| Campo          | Significado                                                 |
| -------------- | ----------------------------------------------------------- |
| `offset`       | Posición inicial en bytes, de 0 a 512.                      |
| `type`         | `int16`, `uint16`, `uint32` o `float32`.                    |
| `littleEndian` | `true` para little endian; `false` para big endian.         |
| `scale`        | Factor positivo finito hasta 1000, aplicado al valor crudo. |

Para aceleración, se definen `x`, `y` y `z`. El resultado debe estar en **g**; por ejemplo, un entero 1000 que representa 1 g usa escala `0.001`. La escala no calibra por sí sola un sensor: el formato no contempla sesgos, matrices de calibración ni comandos de inicialización.

`calibrated` y `includesGravity` deben reflejar propiedades verificadas del dispositivo, no activar casillas para forzar el detector. Sólo con ambas en `true` se evalúa la calidad temporal necesaria para la inferencia de caída. Para pasos se define `value`; su resultado debe ser un entero acumulado no negativo.

Los paquetes deben contener todos los bytes requeridos por los campos. Se rechazan valores no finitos, paquetes cortos y pasos fraccionarios/negativos. El decodificador opera sobre el `DataView` recibido, incluyendo su offset real.

## Sesión H7/Veepoo integrada

Cuando Heart Rate estándar no existe, el runtime busca el servicio propietario `F0080001-0451-4000-B000-000000000000`. Si está presente, carga bajo demanda el SDK oficial Veepoo 1.1.23, abre sus características de notificación/escritura, autentica con `0000`, solicita batería y queda listo para una medición manual. La interfaz muestra descubrimiento, autenticación, preparación, recepción, detención y cooldown.

Los eventos de pulso Veepoo `type: 51` sólo se aceptan entre 30 y 250 BPM. `notWear` se muestra como falta de contacto y `deviceBusy` como una operación en curso; ninguno se convierte en 0 BPM ni crea una alerta clínica falsa. Un clic envía un solo `switch: true` y la medición continúa sin límite temporal hasta la detención manual. Al desconectar, cambiar a demo, cerrar sesión o desmontar el runtime, se envía un único `switch: false` si hay una medición activa antes de cancelar notificaciones y cortar GATT.

El transporte adapta enumeración, notificaciones, escrituras con/sin respuesta, fragmentos limitados por MTU, estado de conexión y el pequeño almacenamiento local que espera el SDK. Resuelve primero los UUID oficiales y, para variantes de firmware dentro del servicio principal, puede asociar los canales por sus capacidades GATT verificadas (`notify`/`indicate` y `write`/`writeWithoutResponse`). Todo ocurre dentro del navegador; no se envían paquetes ni identificadores a un backend. La procedencia y licencia de la copia fijada están en `src/vendor/veepoo/UPSTREAM.md` y `LICENSE`.

La autenticación reutiliza la conexión Web Bluetooth ya abierta: resuelve los canales `F0080002`/`F0080003`, activa las notificaciones, registra el receptor global y recién entonces envía la clave predeterminada `0000`. La confirmación se obtiene de `VPDeviceAck`; `VPDevicepassword` contiene la clave y no representa el resultado. Si no llega la primera confirmación se realiza un único reintento. Un timeout ya no se interpreta automáticamente como que otra aplicación está usando el reloj.

Un H7 ya emparejado por el sistema todavía debe seleccionarse mediante un clic en Chrome/Edge. Ese gesto concede el acceso al origen web; el emparejamiento por sí solo no inicia el protocolo Veepoo. Acelerómetro y pasos del H7 no se deducen de datos no documentados y se muestran como no compatibles.

## Otros protocolos que requieren un adaptador

El perfil declarativo no hace autenticación, cifrado, escritura de comandos, fragmentación/reensamblado ni selección de tipos dentro de un protocolo multiplexado. Tampoco extrae series de múltiples muestras contenidas en un único paquete. Esos dispositivos requieren implementar un adaptador específico en la capa de servicios.

`BleDeviceAdapter` y `getAdapters` están en `src/shared/services/bleProfiles.ts`. El ciclo de suscripción/cancelación está centralizado en `src/monitoring/services/bleSensors.ts`; el motor recibe únicamente valores normalizados. Las operaciones GATT iniciales se preparan secuencialmente para evitar colisiones de operaciones en periféricos limitados.

El H7/Veepoo es la excepción ya integrada. Otros relojes propietarios continúan necesitando documentación y un adaptador específico; un perfil JSON no sustituye su autenticación o secuencia de comandos.

## Calidad temporal para caída experimental

Los timestamps se asignan al recibir la notificación en el navegador. Debe existir una notificación por muestra y una tasa observada mínima de 20 Hz. Una ventana reciente de aproximadamente 1,1 segundos establece disponibilidad; timestamps repetidos/no crecientes, frecuencia insuficiente o brechas mayores a 150 ms invalidan la continuidad.

Después de un impacto de al menos 2,5 g, se exigen diez segundos continuos con desviación estándar no mayor a 0,1 g en cada eje. No basta con una magnitud constante: también se verifica la variación del vector. Un corte cancela el candidato y nunca se interpreta como reposo. Los eventos se separan por al menos sesenta segundos.

Este algoritmo no ha sido validado clínicamente. La latencia, el lugar de colocación, el firmware y la frecuencia del sensor pueden cambiar su comportamiento. La ausencia de un evento no garantiza que no haya ocurrido una caída.
