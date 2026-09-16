import { z } from 'zod'
import type { Acceleration, SensorKind } from '@shared/types/monitoring'

const uuid = z
  .string()
  .regex(
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i,
    'Usá un UUID completo de 128 bits',
  )
const fieldSchema = z.object({
  offset: z.number().int().min(0).max(512),
  type: z.enum(['int16', 'uint16', 'uint32', 'float32']),
  littleEndian: z.boolean(),
  scale: z.number().finite().positive().max(1000),
})
const characteristic = z.object({ service: uuid, characteristic: uuid })
export const bleProfileSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1).max(80),
    acceleration: characteristic
      .extend({
        calibrated: z.boolean(),
        includesGravity: z.boolean(),
        x: fieldSchema,
        y: fieldSchema,
        z: fieldSchema,
      })
      .optional(),
    steps: characteristic.extend({ value: fieldSchema }).optional(),
  })
  .refine((p) => p.acceleration || p.steps, 'El perfil debe incluir acelerómetro o pasos')
export type BleProfileConfig = z.infer<typeof bleProfileSchema>
type NumericField = z.infer<typeof fieldSchema>
export interface BleDeviceAdapter<T = number | Acceleration> {
  kind: SensorKind
  service: string
  characteristic: string
  decode: (data: DataView) => T
}
export function readNumeric(data: DataView, field: NumericField) {
  const size = field.type === 'int16' || field.type === 'uint16' ? 2 : 4
  if (data.byteLength < field.offset + size) throw new Error('Paquete incompleto')
  const { offset, littleEndian } = field
  const raw =
    field.type === 'int16'
      ? data.getInt16(offset, littleEndian)
      : field.type === 'uint16'
        ? data.getUint16(offset, littleEndian)
        : field.type === 'uint32'
          ? data.getUint32(offset, littleEndian)
          : data.getFloat32(offset, littleEndian)
  const value = raw * field.scale
  if (!Number.isFinite(value)) throw new Error('Valor de sensor inválido')
  return value
}
export function getAdapters(profile: BleProfileConfig | null): BleDeviceAdapter[] {
  const adapters: BleDeviceAdapter[] = []
  if (profile?.acceleration) {
    const a = profile.acceleration
    adapters.push({
      kind: 'acceleration',
      service: a.service,
      characteristic: a.characteristic,
      decode: (data) => ({
        x: readNumeric(data, a.x),
        y: readNumeric(data, a.y),
        z: readNumeric(data, a.z),
      }),
    })
  }
  if (profile?.steps) {
    const s = profile.steps
    adapters.push({
      kind: 'steps',
      service: s.service,
      characteristic: s.characteristic,
      decode: (data) => {
        const value = readNumeric(data, s.value)
        if (!Number.isSafeInteger(value) || value < 0) throw new Error('Contador de pasos inválido')
        return value
      },
    })
  }
  return adapters
}
