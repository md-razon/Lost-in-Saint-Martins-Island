export const RAZON_SHEET_PATH =
  '/assets/aistudio/file_000000005f6082108212a89da29dae04_2cff05d3.png';
export const RASEL_SHEET_PATH =
  '/assets/aistudio/file_00000000cf2c8208882c673e2c0487fb_b2a9caea.png';

export interface CharacterPortraits {
  razonPortraitUrl: string;
  raselPortraitUrl: string;
  razonSheet: HTMLImageElement | null;
  raselSheet: HTMLImageElement | null;
}

function cropImageToDataUrl(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  outW = 240,
  outH = 260
): string {
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  return canvas.toDataURL('image/png');
}

export function loadCharacterPortraits(): Promise<CharacterPortraits> {
  return new Promise((resolve) => {
    const result: CharacterPortraits = {
      razonPortraitUrl: '',
      raselPortraitUrl: '',
      razonSheet: null,
      raselSheet: null,
    };

    let done = 0;
    const finishOne = () => {
      done += 1;
      if (done >= 2) resolve(result);
    };

    const razonImg = new Image();
    razonImg.onload = () => {
      result.razonSheet = razonImg;
      result.razonPortraitUrl = cropImageToDataUrl(razonImg, 195, 14, 370, 405, 220, 240);
      finishOne();
    };
    razonImg.onerror = finishOne;
    razonImg.src = RAZON_SHEET_PATH;

    const raselImg = new Image();
    raselImg.onload = () => {
      result.raselSheet = raselImg;
      result.raselPortraitUrl = cropImageToDataUrl(raselImg, 40, 18, 385, 420, 220, 240);
      finishOne();
    };
    raselImg.onerror = finishOne;
    raselImg.src = RASEL_SHEET_PATH;
  });
}
