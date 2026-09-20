export interface VeepooEvent {
  type?: number
  name?: string
  content?: Record<string, unknown>
  errMsg?: string
}

export interface VeepooBleDate {
  deviceId: string
  serviceId: string
  notifyCharacteristicId: string
  writeCharacteristicId: string
}

export interface VeepooSdk {
  init(options: { transport: unknown; bleDate?: VeepooBleDate }): void
  veepooBle: {
    veepooWeiXinSDKConnectionDevice(
      device: { deviceId: string; name?: string },
      callback: (result: Record<string, unknown>) => void,
    ): void
    veepooWeiXinSDKNotifyMonitorValueChange(callback: (event: VeepooEvent) => void): void
    resetBleTransport(): void
  }
  veepooFeature: {
    veepooBlePasswordCheckManager(value: { isPair: boolean }): void
    veepooReadElectricQuantityManager(): void
    veepooSendHeartRateTestSwitchManager(value: { switch: boolean }): void
  }
}

declare const sdk: VeepooSdk
export = sdk
