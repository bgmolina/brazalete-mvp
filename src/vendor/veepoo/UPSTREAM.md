# Veepoo Mini Program BLE SDK

- Repository: https://github.com/HBandSDK/WeChat_Mini_Program_Ble_SDK
- Version: 1.1.23
- Commit: `f42ef8d3f1d71ebc3196a6a204c054325cc582e1`
- Vendored file: `libs/vp_sdk/index.js`
- SHA-256: `1c7a408a40bec3e8484b65aaa363ae0297d5974c94a2c6d8be84b70304d7c104`

The upstream bundle is loaded only after a Veepoo service is detected. Its Apache-2.0 license is
preserved in this directory. The Web Bluetooth transport lives outside the vendored file so the
upstream artifact remains byte-for-byte reproducible.

The bundle uses an obfuscated CommonJS export that Vite cannot recognize in development mode.
`vite.config.ts` exposes it through the private `virtual:veepoo-sdk` module, supplying a scoped
CommonJS container and a default ESM export without changing this upstream file or defining browser
globals.
