import { describe, expect, it } from 'vitest'
import { decodeHeartRate, describeBluetoothError } from '@monitoring/services/bleSensors'
import { bleProfileSchema, getAdapters, readNumeric } from '@shared/services/bleProfiles'
import template from '../public/profiles/perfil-ejemplo.json'
const packet = (...bytes: number[]) => new DataView(new Uint8Array(bytes).buffer)
describe('Mediciones cardíacas BLE estándar', () => {
  it('decodifica ocho bits y contacto desconocido', () => {
    expect(decodeHeartRate(packet(0, 72))).toMatchObject({ bpm: 72, contact: null })
  })
  it('decodifica dieciséis bits little endian', () => {
    expect(decodeHeartRate(packet(1, 44, 1)).bpm).toBe(300)
  })
  it('distingue contacto válido, rechazado y lectura cero', () => {
    expect(decodeHeartRate(packet(6, 81)).contact).toBe(true)
    expect(decodeHeartRate(packet(4, 0))).toMatchObject({ bpm: 0, contact: false })
  })
  it.each([[], [0], [1, 1], [8, 70], [16, 70, 1]].map((bytes) => ({ bytes })))(
    'rechaza paquete truncado $bytes',
    ({ bytes }) => {
      expect(() => decodeHeartRate(packet(...bytes))).toThrow()
    },
  )
  it('admite energía y RR completos', () => {
    expect(decodeHeartRate(packet(24, 70, 2, 0, 255, 3)).bpm).toBe(70)
  })
  it('cancelar selección no se informa como error', () => {
    expect(describeBluetoothError({ code: 'USER_CANCELLED' })).toBeNull()
    expect(describeBluetoothError({ code: 'PERMISSION_DENIED' })).toContain('acceso')
  })
})
describe('Perfiles GATT configurables', () => {
  it('valida esquema, UUID y presencia de sensores', () => {
    expect(bleProfileSchema.safeParse(template).success).toBe(true)
    expect(bleProfileSchema.safeParse({ version: 1, name: 'vacío' }).success).toBe(false)
    expect(
      bleProfileSchema.safeParse({
        ...template,
        steps: { ...template.steps, service: 'incorrecto' },
      }).success,
    ).toBe(false)
  })
  it('decodifica vector int16 escalado a g y contador uint32', () => {
    const adapters = getAdapters(bleProfileSchema.parse(template))
    expect(adapters[0].decode(packet(100, 0, 156, 255, 232, 3))).toEqual({ x: 0.1, y: -0.1, z: 1 })
    expect(adapters[1].decode(packet(255, 255, 0, 0))).toBe(65535)
  })
  it('respeta offset, signo y orden big endian', () => {
    expect(
      readNumeric(packet(0, 255, 156), {
        offset: 1,
        type: 'int16',
        littleEndian: false,
        scale: 0.01,
      }),
    ).toBe(-1)
  })
  it('decodifica float32 y rechaza NaN y paquetes cortos', () => {
    const field = { offset: 0, type: 'float32' as const, littleEndian: true, scale: 1 }
    const buffer = new DataView(new ArrayBuffer(4))
    buffer.setFloat32(0, 1.25, true)
    expect(readNumeric(buffer, field)).toBe(1.25)
    buffer.setFloat32(0, NaN, true)
    expect(() => readNumeric(buffer, field)).toThrow()
    expect(() => readNumeric(packet(0, 0), field)).toThrow('incompleto')
  })
  it('rechaza pasos fraccionarios y escalas inválidas', () => {
    const profile = bleProfileSchema.parse({
      ...template,
      steps: { ...template.steps, value: { ...template.steps.value, scale: 0.5 } },
    })
    expect(() => getAdapters(profile)[1].decode(packet(1, 0, 0, 0))).toThrow('Contador')
    expect(
      bleProfileSchema.safeParse({
        ...template,
        steps: { ...template.steps, value: { ...template.steps.value, scale: -1 } },
      }).success,
    ).toBe(false)
    expect(getAdapters(null)).toEqual([])
  })
})
