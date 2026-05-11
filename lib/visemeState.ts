// ARKit blend shapes for Avaturn / RPM GLBs with morphTargets=ARKit
export const ARKIT_LIP = [
  'jawOpen',
  'mouthFunnel',
  'mouthPucker',
  'mouthSmileLeft', 'mouthSmileRight',
  'mouthStretchLeft', 'mouthStretchRight',
  'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight',
  'mouthDimpleLeft', 'mouthDimpleRight',
  'mouthPressLeft', 'mouthPressRight',
  'mouthRollLower', 'mouthRollUpper',
  'mouthShrugLower', 'mouthShrugUpper',
] as const;

export const ARKIT_EYE = [
  'eyeBlinkLeft', 'eyeBlinkRight',
  'eyeSquintLeft', 'eyeSquintRight',
  'eyeWideLeft', 'eyeWideRight',
] as const;

export const ARKIT_BROW = [
  'browDownLeft', 'browDownRight',
  'browInnerUp',
  'browOuterUpLeft', 'browOuterUpRight',
] as const;

export const ARKIT_ALL = [...ARKIT_LIP, ...ARKIT_EYE, ...ARKIT_BROW] as const;
export type ARKitShape = typeof ARKIT_ALL[number];

// Module-level singleton — shared between audio hook and avatar renderer
export const lipState = {
  target:  Object.fromEntries(ARKIT_LIP.map(k => [k, 0])) as Record<string, number>,
  current: Object.fromEntries(ARKIT_LIP.map(k => [k, 0])) as Record<string, number>,
  speaking: false,
};

// Legacy Oculus Viseme keys for fallback GLBs without ARKit
export const LEGACY_VISEMES = [
  'viseme_sil','viseme_PP','viseme_FF','viseme_TH','viseme_DD',
  'viseme_kk','viseme_CH','viseme_SS','viseme_nn','viseme_RR',
  'viseme_aa','viseme_E','viseme_I','viseme_O','viseme_U',
] as const;

export const legacyLipState = {
  target:  Object.fromEntries(LEGACY_VISEMES.map(k => [k, 0])) as Record<string, number>,
  current: Object.fromEntries(LEGACY_VISEMES.map(k => [k, 0])) as Record<string, number>,
};
