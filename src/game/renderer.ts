import {
  BiomeType,
  FloatingText,
  LevelConfig,
  Particle,
  PlayerPose,
  WorldObject,
} from './types';

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

let sandPatternCache: CanvasPattern | null = null;
let rockPatternCache: CanvasPattern | null = null;

function getSandPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (sandPatternCache) return sandPatternCache;
  const off = document.createElement('canvas');
  off.width = 64;
  off.height = 64;
  const octx = off.getContext('2d');
  if (!octx) return null;
  for (let i = 0; i < 180; i++) {
    const x = (i * 37) % 64;
    const y = (i * 53) % 64;
    octx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(69,39,12,0.09)';
    octx.fillRect(x, y, (i % 2) + 1, 1);
  }
  sandPatternCache = ctx.createPattern(off, 'repeat');
  return sandPatternCache;
}

function getRockPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (rockPatternCache) return rockPatternCache;
  const off = document.createElement('canvas');
  off.width = 72;
  off.height = 72;
  const octx = off.getContext('2d');
  if (!octx) return null;
  octx.strokeStyle = 'rgba(0,0,0,0.16)';
  octx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    octx.beginPath();
    octx.moveTo((i * 19) % 72, (i * 23) % 72);
    octx.lineTo(((i * 19) % 72) + 18, ((i * 23) % 72) + 5);
    octx.stroke();
  }
  for (let i = 0; i < 90; i++) {
    octx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)';
    octx.fillRect((i * 41) % 72, (i * 29) % 72, 2, 1.5);
  }
  rockPatternCache = ctx.createPattern(off, 'repeat');
  return rockPatternCache;
}

export function drawRazon(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  facing: 1 | -1,
  pose: PlayerPose,
  animTime: number,
  options?: {
    lifeJacket?: boolean;
    hurtFlash?: boolean;
    scale?: number;
    phonePose?: 'check' | 'ear' | 'raise';
    mood?: 'worried' | 'tired' | 'smile' | 'annoyed';
    talking?: boolean;
    phoneSignal?: 0 | 1 | 2 | 3;
  }
) {
  const scale = options?.scale ?? 1;
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.scale(facing * scale, scale);

  if (options?.hurtFlash && Math.floor(animTime * 20) % 2 === 0) {
    ctx.globalAlpha = 0.52;
  }

  // Realistic Swim Pose
  if (pose === 'swim') {
    ctx.translate(0, -15);
    ctx.rotate(Math.sin(animTime * 4.5) * 0.06);

    const kick = Math.sin(animTime * 8.5) * 7;
    drawArticulatedLimb(ctx, -10, 2, -23, 4 + kick * 0.35, -37, 6 + kick * 0.7, 6.2, 4.8, '#26292e', '#1f2226');
    drawArticulatedLimb(ctx, -10, -2, -22, -4 - kick * 0.35, -35, -5 - kick * 0.7, 6.2, 4.8, '#1e2125', '#181a1e');

    // Backpack
    const bpGrad = ctx.createLinearGradient(-18, -14, 0, -2);
    bpGrad.addColorStop(0, '#2a2e35');
    bpGrad.addColorStop(1, '#121417');
    ctx.fillStyle = bpGrad;
    roundedRect(ctx, -17, -13, 19, 11, 3);
    ctx.fill();

    // Olive explorer jacket torso
    const jGrad = ctx.createLinearGradient(-14, -8, 12, 8);
    jGrad.addColorStop(0, '#5d6e47');
    jGrad.addColorStop(1, '#364228');
    ctx.fillStyle = jGrad;
    roundedRect(ctx, -13, -7, 26, 13, 4);
    ctx.fill();

    if (options?.lifeJacket) {
      ctx.fillStyle = '#ea580c';
      roundedRect(ctx, -9, -8, 17, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(-5, -5, 9, 2);
    }

    const strokeA = animTime * 6.5;
    const elbowX = 8 + Math.cos(strokeA) * 6;
    const elbowY = -3 + Math.sin(strokeA) * 5;
    const handX = 19 + Math.cos(strokeA) * 11;
    const handY = -2 + Math.sin(strokeA) * 8;
    drawArticulatedLimb(ctx, 5, -3, elbowX, elbowY, handX, handY, 5.2, 4, '#4d5c3a', '#b67d57');
    ctx.fillStyle = '#b67d57';
    ctx.beginPath();
    ctx.arc(handX, handY, 2.7, 0, Math.PI * 2);
    ctx.fill();

    drawRealisticRazonHead(ctx, 18, -11, 0.1);
    ctx.restore();
    return;
  }

  // Climb Pose
  if (pose === 'climb') {
    const climbCycle = animTime * 8;
    const leftLift = Math.sin(climbCycle) * 8;
    const rightLift = -Math.sin(climbCycle) * 8;

    drawArticulatedLimb(ctx, -3, -32, -8, -18 + leftLift * 0.5, -5, -4 + leftLift, 6.8, 5.4, '#24272c', '#1e2125');
    drawArticulatedLimb(ctx, 3, -32, 8, -18 + rightLift * 0.5, 5, -4 + rightLift, 6.8, 5.4, '#32363d', '#282b30');

    drawRazonTorsoAndBackpack(ctx, -32, 0.08, options?.lifeJacket);
    drawArticulatedLimb(ctx, -3, -52, -9, -58 + rightLift * 0.6, -2, -68 + rightLift, 5, 4, '#3d4a2e', '#b67d57');
    drawArticulatedLimb(ctx, 3, -52, 9, -58 + leftLift * 0.6, 4, -68 + leftLift, 5.2, 4.2, '#576843', '#c48962');
    drawRealisticRazonHead(ctx, 1, -67, 0);
    ctx.restore();
    return;
  }

  const isCrouch = pose === 'crouch' || pose === 'interact';
  const crouchDrop = isCrouch ? 16 : 0;
  const breath = pose === 'idle' ? Math.sin(animTime * 2.8) * 1.1 : 0;
  const stride =
    pose === 'run'
      ? Math.sin(animTime * 13.5)
      : pose === 'walk'
      ? Math.sin(animTime * 7.5)
      : 0;
  const lean = pose === 'run' ? 0.16 : pose === 'walk' ? 0.05 : isCrouch ? 0.24 : 0;

  // Soft ground ambient occlusion shadow
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath();
  ctx.ellipse(0, 0, isCrouch ? 19 : 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, crouchDrop);

  // Back Leg
  const backSpread = pose === 'jump' ? -8 : -stride * (pose === 'run' ? 14 : 9);
  const backLift = pose === 'jump' ? 8 : Math.max(0, -stride) * 5;
  const backKneeX = -2 + backSpread * 0.55 + (isCrouch ? 9 : 4);
  const backKneeY = -15 + breath * 0.4 - backLift * 0.4;
  drawArticulatedLimb(
    ctx,
    -2,
    -30 + breath,
    backKneeX,
    backKneeY,
    -3 + backSpread,
    -2 - backLift,
    7,
    5.4,
    '#23272c',
    '#1f2227'
  );
  drawHikingBoot(ctx, -3 + backSpread, -2 - backLift);

  // Back Arm
  const armSwing = pose === 'jump' ? -11 : -stride * (pose === 'run' ? 14 : 7);
  drawArticulatedLimb(
    ctx,
    2,
    -51 + breath,
    4 + armSwing * 0.5,
    -40 + breath,
    5 + armSwing,
    -29 + breath,
    5.2,
    4,
    '#38452b',
    '#b67d57'
  );

  // Torso + Backpack + Head
  ctx.save();
  ctx.translate(0, -30 + breath);
  ctx.rotate(lean);
  drawRazonTorsoAndBackpack(ctx, 0, 0, options?.lifeJacket);
  drawRealisticRazonHead(ctx, 1.5, -36, lean * 0.25, {
    mood: options?.mood,
    talking: options?.talking,
    animTime,
  });
  ctx.restore();

  // Front Leg (with cargo pocket shading)
  const frontSpread = pose === 'jump' ? 9 : stride * (pose === 'run' ? 14 : 9);
  const frontLift = pose === 'jump' ? 11 : Math.max(0, stride) * 6;
  const frontKneeX = 2 + frontSpread * 0.55 + (isCrouch ? 10 : 4);
  const frontKneeY = -15 + breath * 0.4 - frontLift * 0.4;
  drawArticulatedLimb(
    ctx,
    2,
    -30 + breath,
    frontKneeX,
    frontKneeY,
    3 + frontSpread,
    -2 - frontLift,
    7.4,
    5.6,
    '#32373e',
    '#282c32'
  );
  drawHikingBoot(ctx, 3 + frontSpread, -2 - frontLift);

  // Front Arm (supports satellite phone poses: check, ear, raise)
  let fHandX =
    pose === 'interact'
      ? 17 + Math.sin(animTime * 11) * 3
      : pose === 'jump'
      ? 12
      : 1 - armSwing;
  let fHandY = pose === 'interact' ? -30 : pose === 'jump' ? -46 : -28 + breath;
  let fElbowX = (1 + fHandX) * 0.5 - 2;
  let fElbowY = (-51 + breath + fHandY) * 0.5 + 2;

  if (options?.phonePose === 'check') {
    fHandX = 15;
    fHandY = -44 + breath;
    fElbowX = 6;
    fElbowY = -36 + breath;
  } else if (options?.phonePose === 'ear') {
    fHandX = 8.5;
    fHandY = -63 + breath;
    fElbowX = 13.5;
    fElbowY = -48 + breath;
  } else if (options?.phonePose === 'raise') {
    fHandX = 11 + Math.sin(animTime * 4.5) * 1.6;
    fHandY = -88 + breath;
    fElbowX = 8.5;
    fElbowY = -69 + breath;
  }

  drawArticulatedLimb(
    ctx,
    1,
    -51 + breath,
    fElbowX,
    fElbowY,
    fHandX,
    fHandY,
    5.5,
    4.2,
    '#556742',
    '#c48962'
  );
  ctx.fillStyle = '#c48962';
  ctx.beginPath();
  ctx.arc(fHandX, fHandY, 2.5, 0, Math.PI * 2);
  ctx.fill();

  if (options?.phonePose) {
    drawSatellitePhoneInHand(
      ctx,
      fHandX,
      fHandY,
      options.phonePose,
      animTime,
      options.phoneSignal ?? 1
    );
  }

  ctx.restore();
}

function drawRazonTorsoAndBackpack(
  ctx: CanvasRenderingContext2D,
  offsetY: number,
  tilt: number,
  lifeJacket?: boolean
) {
  ctx.save();
  ctx.translate(0, offsetY);
  ctx.rotate(tilt);

  // Tactical Black Backpack (layered silhouette + pocket + buckles)
  const bpGrad = ctx.createLinearGradient(-17, -25, -4, 0);
  bpGrad.addColorStop(0, '#2a2e35');
  bpGrad.addColorStop(1, '#111317');
  ctx.fillStyle = bpGrad;
  roundedRect(ctx, -16.5, -24, 12, 23, 3);
  ctx.fill();
  ctx.fillStyle = '#20242a';
  roundedRect(ctx, -15.5, -15, 9, 10, 2);
  ctx.fill();
  ctx.strokeStyle = '#3b414c';
  ctx.lineWidth = 1;
  ctx.strokeRect(-15, -14.5, 8, 4);

  // Olive-green Explorer Jacket with natural lighting gradient
  const jGrad = ctx.createLinearGradient(-8, -26, 10, 0);
  jGrad.addColorStop(0, '#3a472d');
  jGrad.addColorStop(0.55, '#526340');
  jGrad.addColorStop(1, '#687a52');
  ctx.fillStyle = jGrad;
  roundedRect(ctx, -8, -26, 17, 26, 4);
  ctx.fill();

  // Inner black crew-neck T-shirt exposed at jacket opening
  ctx.fillStyle = '#121316';
  ctx.beginPath();
  ctx.moveTo(2, -25);
  ctx.lineTo(8, -24);
  ctx.lineTo(7.5, -2);
  ctx.lineTo(1.5, -2);
  ctx.closePath();
  ctx.fill();

  // Jacket collar / hood fold
  ctx.fillStyle = '#3b492e';
  ctx.beginPath();
  ctx.moveTo(-8, -26);
  ctx.lineTo(3, -27);
  ctx.lineTo(1, -21);
  ctx.lineTo(-8, -21);
  ctx.closePath();
  ctx.fill();

  // Backpack shoulder strap
  ctx.strokeStyle = '#181b20';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-2, -25);
  ctx.quadraticCurveTo(2, -16, 0.5, -5);
  ctx.stroke();

  if (lifeJacket) {
    const ljGrad = ctx.createLinearGradient(-8, -22, 10, -5);
    ljGrad.addColorStop(0, '#c2410c');
    ljGrad.addColorStop(1, '#f97316');
    ctx.fillStyle = ljGrad;
    roundedRect(ctx, -8, -22, 17.5, 17, 3);
    ctx.fill();
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(-5, -14, 11, 2.2);
  }

  ctx.restore();
}

function drawSatellitePhoneInHand(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  phonePose: 'check' | 'ear' | 'raise',
  time: number,
  signalBars: 0 | 1 | 2 | 3
) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(phonePose === 'check' ? -0.42 : phonePose === 'ear' ? -0.18 : 0.04);

  // Thick rugged satellite antenna
  ctx.fillStyle = '#0f172a';
  roundedRect(ctx, 1.5, -18, 2.6, 10, 1);
  ctx.fill();
  ctx.fillStyle = signalBars > 0 ? '#22d3ee' : '#ef4444';
  ctx.beginPath();
  ctx.arc(2.8, -18.5, 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Rugged satellite handset body
  ctx.fillStyle = '#1e293b';
  roundedRect(ctx, -3, -9.5, 7.2, 13.5, 1.6);
  ctx.fill();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 0.7;
  ctx.strokeRect(-3, -9.5, 7.2, 13.5);

  // Glowing phone screen
  ctx.fillStyle = signalBars > 0 ? '#38bdf8' : '#f87171';
  ctx.fillRect(-1.6, -7.8, 4.4, 4.8);

  // Animated radio waves from antenna when connected or searching
  if (phonePose === 'raise' || signalBars > 0) {
    for (let i = 0; i < 2; i++) {
      const pulse = (time * 2.1 + i * 0.5) % 1;
      ctx.strokeStyle =
        signalBars > 0
          ? `rgba(34, 211, 238, ${0.75 * (1 - pulse)})`
          : `rgba(251, 191, 36, ${0.65 * (1 - pulse)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(2.8, -19, 4 + pulse * 10, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawRealisticRazonHead(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  tilt: number,
  expr?: { mood?: 'worried' | 'tired' | 'smile' | 'annoyed'; talking?: boolean; animTime?: number }
) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);

  // Neck with chin shadow
  ctx.fillStyle = '#a8704c';
  ctx.fillRect(-3.2, 5.5, 6.4, 6);

  // Sculpted face gradient
  const skin = ctx.createLinearGradient(-7, -8, 8, 7);
  skin.addColorStop(0, '#aa724e');
  skin.addColorStop(0.55, '#c68d65');
  skin.addColorStop(1, '#d69d75');
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-6, -7);
  ctx.quadraticCurveTo(2, -10, 7, -4);
  ctx.lineTo(7.6, 1.5);
  ctx.quadraticCurveTo(6.5, 8.5, 0, 9.2);
  ctx.quadraticCurveTo(-7, 7, -7.2, -1);
  ctx.closePath();
  ctx.fill();

  // Beard & jawline contour
  ctx.fillStyle = '#17191e';
  ctx.beginPath();
  ctx.moveTo(-5.5, 1.5);
  ctx.quadraticCurveTo(-2, 4.5, 4.5, 3.2);
  ctx.lineTo(7.2, 1.8);
  ctx.quadraticCurveTo(6.2, 9.2, -0.5, 9.5);
  ctx.quadraticCurveTo(-6.2, 7.6, -6.5, 2.2);
  ctx.closePath();
  ctx.fill();
  // Mustache
  ctx.fillRect(0.5, 2.2, 6.2, 1.8);

  // Animated mouth / facial expression
  const t = expr?.animTime ?? 0;
  if (expr?.talking) {
    const open = 0.65 + Math.abs(Math.sin(t * 17)) * 1.45;
    ctx.fillStyle = '#4c1d1d';
    ctx.beginPath();
    ctx.ellipse(4.4, 4.7, 1.7, open, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e5b293';
    ctx.fillRect(3.5, 4.0, 1.7, 0.55);
  } else if (expr?.mood === 'smile') {
    ctx.strokeStyle = '#e2a888';
    ctx.lineWidth = 1.05;
    ctx.beginPath();
    ctx.arc(4.2, 4.2, 1.8, 0.15, Math.PI * 0.75);
    ctx.stroke();
  } else if (expr?.mood === 'worried' || expr?.mood === 'annoyed') {
    ctx.strokeStyle = '#d29372';
    ctx.lineWidth = 0.95;
    ctx.beginPath();
    ctx.moveTo(2.9, 5.1);
    ctx.quadraticCurveTo(4.4, 4.2, 5.8, 5.2);
    ctx.stroke();
  }

  // Subtle nose bridge & brow
  ctx.strokeStyle = 'rgba(72, 42, 24, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(5.8, -3);
  ctx.lineTo(7.8, 0.8);
  ctx.lineTo(5.8, 1.4);
  ctx.stroke();

  // Eye & expressive brow
  ctx.save();
  ctx.translate(4, -3.1);
  if (expr?.mood === 'worried') ctx.rotate(-0.22);
  else if (expr?.mood === 'annoyed') ctx.rotate(0.24);
  else if (expr?.mood === 'tired') ctx.rotate(-0.08);
  ctx.fillStyle = '#16171b';
  ctx.fillRect(-2, -0.5, 4, 1.3);
  ctx.restore();

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(2.6, expr?.mood === 'tired' ? -1.4 : -1.8, 2.5, expr?.mood === 'tired' ? 1.05 : 1.5);
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(3.8, expr?.mood === 'tired' ? -1.35 : -1.7, 1.3, expr?.mood === 'tired' ? 0.95 : 1.3);

  // Textured curly black hair (layered realistic curls, not flat circles)
  ctx.fillStyle = '#121418';
  ctx.beginPath();
  ctx.moveTo(-7.8, 0);
  ctx.quadraticCurveTo(-9, -7, -4, -10);
  ctx.quadraticCurveTo(1.5, -11.5, 6.8, -7.2);
  ctx.quadraticCurveTo(7.8, -4.5, 4.5, -4.5);
  ctx.quadraticCurveTo(-1, -6.5, -4.5, -3);
  ctx.quadraticCurveTo(-5.5, 0.5, -7.5, 1.5);
  ctx.closePath();
  ctx.fill();

  // Hair curl rim highlights
  ctx.strokeStyle = '#2e333d';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(-3, -7.5, 2.5, Math.PI, Math.PI * 1.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(2.2, -7.8, 2.4, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();

  ctx.restore();
}

function drawArticulatedLimb(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w1: number,
  w2: number,
  c1: string,
  c2: string
) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = c1;
  ctx.lineWidth = w1;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  ctx.strokeStyle = c2;
  ctx.lineWidth = w2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawHikingBoot(ctx: CanvasRenderingContext2D, fx: number, fy: number) {
  ctx.fillStyle = '#736f67';
  roundedRect(ctx, fx - 3, fy - 3, 10.5, 4.5, 1.8);
  ctx.fill();
  ctx.fillStyle = '#181a1f';
  ctx.fillRect(fx - 3, fy + 1.2, 10.5, 2.2);
}

export function drawRaselVai(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: 1 | -1,
  time: number,
  waving = true
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);

  // Black cargo pants (healthy build)
  drawArticulatedLimb(ctx, -4, -30, -5, -16, -5, -2, 8.2, 6.8, '#23262b', '#1b1d22');
  drawArticulatedLimb(ctx, 4, -30, 5, -16, 5, -2, 8.2, 6.8, '#2b2f35', '#21242a');
  drawHikingBoot(ctx, -7, -2);
  drawHikingBoot(ctx, 3, -2);

  // Backpack
  ctx.fillStyle = '#17191d';
  roundedRect(ctx, -18, -56, 11, 25, 3);
  ctx.fill();

  // Sky-blue T-shirt with natural gradient
  const tGrad = ctx.createLinearGradient(-12, -57, 12, -28);
  tGrad.addColorStop(0, '#0284c7');
  tGrad.addColorStop(0.6, '#1d9bf0');
  tGrad.addColorStop(1, '#38bdf8');
  ctx.fillStyle = tGrad;
  roundedRect(ctx, -12, -57, 24, 30, 5);
  ctx.fill();

  // Subtle white chest graphic
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillRect(-5, -47, 13, 2.6);
  ctx.fillRect(-3, -42, 9, 1.8);

  const wave = waving ? Math.sin(time * 7) * 7 : 0;
  drawArticulatedLimb(ctx, 9, -53, 15, -58, 20, -64 + wave, 6, 4.8, '#1d9bf0', '#b47852');
  drawArticulatedLimb(ctx, -9, -53, -12, -42, -13, -31, 6, 4.8, '#0284c7', '#a86e49');

  // Head
  ctx.fillStyle = '#b97c54';
  ctx.beginPath();
  ctx.ellipse(0, -68, 9, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Neat full beard
  ctx.fillStyle = '#181a1f';
  ctx.beginPath();
  ctx.arc(0, -65.5, 8.8, 0.15, Math.PI - 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-3.5, -65.5, 9, 2);

  // Short dark hair
  ctx.fillStyle = '#15171b';
  ctx.beginPath();
  ctx.arc(-0.5, -73, 8.2, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(2.2, -70, 2.8, 1.8);
  ctx.fillStyle = '#141518';
  ctx.fillRect(3.4, -70, 1.4, 1.8);

  ctx.restore();
}

export function drawRaselVaiLeaning(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  reaching = true
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-0.58, 0.58); // Face left toward Razon, properly scaled to helicopter cabin height

  // Kneeling black cargo pants inside cabin floor
  drawArticulatedLimb(ctx, -6, -24, -12, -10, -2, -2, 8.4, 7.0, '#23262b', '#1b1d22');
  drawArticulatedLimb(ctx, 2, -24, -2, -10, 6, -2, 8.4, 7.0, '#2b2f35', '#21242a');
  drawHikingBoot(ctx, -4, -2);
  drawHikingBoot(ctx, 4, -2);

  // Leaning upper torso forward out of the rescue doorway
  ctx.save();
  ctx.translate(-2, -22);
  ctx.rotate(0.46); // Lean forward toward Razon!

  // Black backpack on his back
  ctx.fillStyle = '#17191d';
  roundedRect(ctx, -18, -32, 11, 24, 3);
  ctx.fill();

  // Sky-blue T-shirt
  const tGrad = ctx.createLinearGradient(-12, -33, 12, -2);
  tGrad.addColorStop(0, '#0284c7');
  tGrad.addColorStop(0.6, '#1d9bf0');
  tGrad.addColorStop(1, '#38bdf8');
  ctx.fillStyle = tGrad;
  roundedRect(ctx, -12, -33, 24, 31, 5);
  ctx.fill();

  // Subtle white chest graphic
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillRect(-5, -23, 13, 2.6);
  ctx.fillRect(-3, -18, 9, 1.8);

  // Bracing back arm holding cabin frame + reaching/beckoning front arm extending down toward Razon
  drawArticulatedLimb(ctx, -8, -28, -14, -18, -15, -6, 6, 4.8, '#0284c7', '#a86e49');
  const reachSwing = reaching ? Math.sin(time * 6.5) * 4.5 : 0;
  drawArticulatedLimb(
    ctx,
    8,
    -28,
    20,
    -16 + reachSwing * 0.4,
    28,
    -4 + reachSwing,
    6,
    4.8,
    '#1d9bf0',
    '#b47852'
  );

  // Head angled slightly downward toward Razon
  ctx.save();
  ctx.translate(2, -43);
  ctx.rotate(-0.18);
  ctx.fillStyle = '#b97c54';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Full beard
  ctx.fillStyle = '#181a1f';
  ctx.beginPath();
  ctx.arc(0, 2.5, 8.8, 0.15, Math.PI - 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-3.5, 2.5, 9, 2);

  // Short dark hair
  ctx.fillStyle = '#15171b';
  ctx.beginPath();
  ctx.arc(-0.5, -5, 8.2, Math.PI, Math.PI * 2);
  ctx.fill();

  // Eye looking toward Razon
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(2.2, -2, 2.8, 1.8);
  ctx.fillStyle = '#141518';
  ctx.fillRect(3.4, -2, 1.4, 1.8);
  ctx.restore();

  ctx.restore();
  ctx.restore();
}

export function drawFriend(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: 0 | 1 | 2 | 3,
  time: number
) {
  const shirts = ['#b91c1c', '#ca8a04', '#1e3a8a', '#e2e8f0'];
  const pants = ['#57534e', '#1e293b', '#78350f', '#1f2937'];
  const skin = ['#c48a62', '#b47952', '#cc9872', '#ba8058'][variant];
  const bob = Math.sin(time * 3.2 + variant * 1.4) * 1.8;

  ctx.save();
  ctx.translate(x, y + bob);

  drawArticulatedLimb(ctx, -4, -26, -4, -13, -4, 0, 6.2, 5, pants[variant], pants[variant]);
  drawArticulatedLimb(ctx, 4, -26, 4, -13, 4, 0, 6.2, 5, pants[variant], pants[variant]);

  ctx.fillStyle = shirts[variant];
  roundedRect(ctx, -8.5, -51, 17, 26, 4);
  ctx.fill();

  if (variant === 0) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-8, -44, 16, 2.5);
    ctx.fillRect(-8, -36, 16, 2.5);
  } else if (variant === 3) {
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(-8.5, -51, 5, 25);
    ctx.fillRect(3.5, -51, 5, 25);
  }

  const armWave = Math.sin(time * 4 + variant) * 5;
  drawArticulatedLimb(ctx, 7, -47, 11, -52, 15, -57 + armWave, 4.8, 3.8, shirts[variant], skin);
  drawArticulatedLimb(ctx, -7, -47, -10, -39, -11, -30, 4.8, 3.8, shirts[variant], skin);

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, -59, 7, 8.2, 0, 0, Math.PI * 2);
  ctx.fill();

  if (variant === 1) {
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, -62, 7.6, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-9, -63, 10, 2.5);
  } else {
    ctx.fillStyle = '#15171b';
    ctx.beginPath();
    ctx.arc(0, -63, 7.4, Math.PI, 0);
    ctx.fill();
  }

  if (variant === 0) {
    ctx.fillStyle = '#09090b';
    ctx.fillRect(-1.5, -61, 7.5, 2.8);
  }

  ctx.restore();
}

function drawTrawler(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  // Shaded wooden hull planks
  const hullGrad = ctx.createLinearGradient(0, -24, 0, 28);
  hullGrad.addColorStop(0, '#5c341f');
  hullGrad.addColorStop(0.6, '#3e2112');
  hullGrad.addColorStop(1, '#261209');
  ctx.fillStyle = hullGrad;
  ctx.beginPath();
  ctx.moveTo(-138, -18);
  ctx.lineTo(148, -26);
  ctx.lineTo(122, 28);
  ctx.lineTo(-116, 28);
  ctx.closePath();
  ctx.fill();

  // Plank lines
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-125, 4);
  ctx.lineTo(132, 2);
  ctx.moveTo(-120, 14);
  ctx.lineTo(128, 12);
  ctx.stroke();

  // Green & red Bangladeshi trawler stripes
  ctx.fillStyle = '#166534';
  ctx.fillRect(-124, -10, 254, 7);
  ctx.fillStyle = '#991b1b';
  ctx.fillRect(-120, -3, 246, 4.5);

  // Wooden posts & canopy
  ctx.fillStyle = '#451a03';
  ctx.fillRect(-85, -72, 5, 54);
  ctx.fillRect(65, -72, 5, 54);
  ctx.fillRect(-10, -72, 5, 54);

  const roofGrad = ctx.createLinearGradient(0, -76, 0, -62);
  roofGrad.addColorStop(0, '#1d4ed8');
  roofGrad.addColorStop(1, '#1e3a8a');
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(-98, -72);
  ctx.lineTo(80, -76);
  ctx.lineTo(88, -64);
  ctx.lineTo(-104, -62);
  ctx.closePath();
  ctx.fill();

  // Cabin + lantern glow
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-82, -62, 46, 44);
  ctx.fillStyle = '#bae6fd';
  ctx.fillRect(-74, -55, 24, 16);
  ctx.fillStyle = 'rgba(253, 224, 71, 0.85)';
  ctx.beginPath();
  ctx.arc(62, -55, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Flag mast
  ctx.fillStyle = '#d6d3d1';
  ctx.fillRect(102, -96, 3, 74);
  ctx.fillStyle = '#15803d';
  ctx.fillRect(105, -94, 34, 21);
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(121, -83.5, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawPalmTree(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  height: number,
  time: number,
  curve = 0.15
) {
  const sway = Math.sin(time * 1.2 + baseX * 0.01) * 5;
  const ctrlX = baseX + height * curve * 0.45;
  const ctrlY = baseY - height * 0.55;
  const topX = baseX + height * curve + sway;
  const topY = baseY - height;

  // Textured tapered palm trunk
  const segments = 10;
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const x0 = (1 - t0) * (1 - t0) * baseX + 2 * (1 - t0) * t0 * ctrlX + t0 * t0 * topX;
    const y0 = (1 - t0) * (1 - t0) * baseY + 2 * (1 - t0) * t0 * ctrlY + t0 * t0 * topY;
    const x1 = (1 - t1) * (1 - t1) * baseX + 2 * (1 - t1) * t1 * ctrlX + t1 * t1 * topX;
    const y1 = (1 - t1) * (1 - t1) * baseY + 2 * (1 - t1) * t1 * ctrlY + t1 * t1 * topY;
    ctx.strokeStyle = i % 2 === 0 ? '#5c402c' : '#6c4d36';
    ctx.lineWidth = 12 - t0 * 5.5;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // Shaded coconuts
  for (const [ox, oy] of [
    [-5, 4],
    [4, 5],
    [0, 8],
  ]) {
    const cg = ctx.createRadialGradient(topX + ox - 1.5, topY + oy - 1.5, 1, topX + ox, topY + oy, 5);
    cg.addColorStop(0, '#84cc16');
    cg.addColorStop(1, '#365314');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(topX + ox, topY + oy, 4.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Realistic pinnate palm fronds (spine + individual drooping leaflets)
  const angles = [-2.55, -2.0, -1.45, -0.85, -0.35, 0.25, 0.78];
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i] + Math.sin(time * 1.6 + i * 0.7) * 0.04;
    const len = 50 + (i % 2) * 12;
    const midX = topX + Math.cos(a) * len * 0.55;
    const midY = topY + Math.sin(a) * len * 0.35 - 7;
    const endX = topX + Math.cos(a) * len;
    const endY = topY + Math.sin(a) * len + 20;

    // Frond spine
    ctx.strokeStyle = i % 2 === 0 ? '#166534' : '#14532d';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(midX, midY, endX, endY);
    ctx.stroke();

    // Fine drooping leaflets along spine
    ctx.strokeStyle = i % 2 === 0 ? '#15803d' : '#166534';
    ctx.lineWidth = 1.6;
    const steps = 11;
    for (let s = 2; s <= steps; s++) {
      const t = s / steps;
      const sx = (1 - t) * (1 - t) * topX + 2 * (1 - t) * t * midX + t * t * endX;
      const sy = (1 - t) * (1 - t) * topY + 2 * (1 - t) * t * midY + t * t * endY;
      const leafLen = (1 - Math.abs(t - 0.5)) * 16 + 4;
      const dir = Math.cos(a) >= 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + dir * 4, sy + leafLen * 0.5, sx + dir * 2, sy + leafLen);
      ctx.stroke();
    }
  }
}

export function renderIntroScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sceneIndex: number,
  sceneProgress: number,
  totalTime: number
) {
  ctx.clearRect(0, 0, w, h);

  const horizonY = h * 0.58;
  const isStorm = sceneIndex === 2 || sceneIndex === 3;

  // Atmospheric multi-stop sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  if (sceneIndex <= 1) {
    sky.addColorStop(0, '#0369a1');
    sky.addColorStop(0.55, '#38bdf8');
    sky.addColorStop(1, '#e0f2fe');
  } else if (isStorm) {
    sky.addColorStop(0, '#050811');
    sky.addColorStop(0.55, '#172033');
    sky.addColorStop(1, '#2b384e');
  } else if (sceneIndex === 4) {
    sky.addColorStop(0, '#091122');
    sky.addColorStop(0.6, '#163457');
    sky.addColorStop(1, '#38bdf8');
  } else {
    sky.addColorStop(0, '#162c4f');
    sky.addColorStop(0.45, '#d97706');
    sky.addColorStop(1, '#fde68a');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizonY + 20);

  // Soft sun glow or storm lightning
  if (sceneIndex <= 1 || sceneIndex >= 5) {
    const sunX = w * 0.78;
    const sunY = sceneIndex >= 5 ? horizonY - 24 : h * 0.22;
    const glow = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 130);
    glow.addColorStop(0, 'rgba(254, 249, 195, 0.95)');
    glow.addColorStop(0.35, 'rgba(253, 224, 71, 0.35)');
    glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 130, 0, Math.PI * 2);
    ctx.fill();
  } else if (isStorm) {
    const flash = Math.sin(totalTime * 11.5) > 0.92;
    if (flash) {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.28)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(w * 0.68, 0);
      ctx.lineTo(w * 0.63, h * 0.22);
      ctx.lineTo(w * 0.69, h * 0.26);
      ctx.lineTo(w * 0.61, h * 0.48);
      ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const cg = ctx.createRadialGradient(
        (i * w) / 5 + Math.sin(totalTime + i) * 14,
        h * 0.14,
        15,
        (i * w) / 5,
        h * 0.14,
        115
      );
      cg.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
      cg.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc((i * w) / 5, h * 0.14, 115, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Teknaf headland receding in Scene 1
  if (sceneIndex === 0) {
    const shoreOffset = -sceneProgress * 180;
    ctx.fillStyle = '#365314';
    ctx.beginPath();
    ctx.moveTo(shoreOffset, horizonY);
    ctx.quadraticCurveTo(shoreOffset + 140, horizonY - 62, shoreOffset + 280, horizonY);
    ctx.fill();
    ctx.fillStyle = '#5c341f';
    ctx.fillRect(shoreOffset + 20, horizonY - 12, 160, 8);
    for (let p = 35; p < 170; p += 32) {
      ctx.fillRect(shoreOffset + p, horizonY - 12, 5, 28);
    }
  }

  // Sea body with horizon mist
  const seaGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  if (isStorm) {
    seaGrad.addColorStop(0, '#0f172a');
    seaGrad.addColorStop(1, '#04192b');
  } else {
    seaGrad.addColorStop(0, '#0369a1');
    seaGrad.addColorStop(0.5, '#075985');
    seaGrad.addColorStop(1, '#082f49');
  }
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  // Subtle horizontal sea glints
  ctx.fillStyle = isStorm ? 'rgba(148, 163, 184, 0.12)' : 'rgba(224, 242, 254, 0.18)';
  for (let i = 0; i < 16; i++) {
    const ry = horizonY + 8 + ((i * 23) % (h - horizonY - 16));
    const rx = ((i * 137 + totalTime * 28) % (w + 80)) - 40;
    ctx.fillRect(rx, ry, 44 + (i % 3) * 18, 1.5);
  }

  if (sceneIndex === 0) {
    const boatX = w * (0.36 + sceneProgress * 0.25);
    const boatY = horizonY + 34 + Math.sin(totalTime * 2.5) * 4;
    drawTrawler(ctx, boatX, boatY, Math.sin(totalTime * 2) * 0.03, 1.05);
    drawRazon(ctx, boatX + 18, boatY - 14, 1, 'idle', totalTime, { scale: 0.72 });
    drawFriend(ctx, boatX + 46, boatY - 14, 0, totalTime);
    drawFriend(ctx, boatX + 70, boatY - 14, 1, totalTime);
  } else if (sceneIndex === 1) {
    const boatX = w * 0.5;
    const boatY = horizonY + 52 + Math.sin(totalTime * 2.4) * 5;
    drawTrawler(ctx, boatX, boatY, Math.sin(totalTime * 2) * 0.025, 1.55);
    drawRazon(ctx, boatX - 24, boatY - 22, 1, 'idle', totalTime, { scale: 1.05 });
    drawFriend(ctx, boatX + 22, boatY - 22, 0, totalTime);
    drawFriend(ctx, boatX + 58, boatY - 22, 1, totalTime);
    drawFriend(ctx, boatX + 94, boatY - 22, 2, totalTime);
    drawFriend(ctx, boatX - 66, boatY - 22, 3, totalTime);
  } else if (sceneIndex === 2) {
    const boatX = w * 0.5 + Math.sin(totalTime * 3) * 18;
    const boatY = horizonY + 35 + Math.sin(totalTime * 5) * 18;
    const tilt = Math.sin(totalTime * 4.5) * 0.22;
    drawTrawler(ctx, boatX, boatY, tilt, 1.18);
    drawRazon(ctx, boatX + 14, boatY - 14, 1, 'crouch', totalTime, { scale: 0.85, lifeJacket: true });
  } else if (sceneIndex === 3) {
    const sinkDrop = sceneProgress * 120;
    const boatX = w * 0.44;
    const boatY = horizonY + 35 + sinkDrop;
    drawTrawler(ctx, boatX, boatY, -0.58 - sceneProgress * 0.35, 1.15);
    const razonX = w * (0.52 + sceneProgress * 0.14);
    const razonY =
      sceneProgress < 0.45
        ? horizonY - 10 + Math.sin(sceneProgress * Math.PI * 2.2) * -32
        : horizonY + 42 + Math.sin(totalTime * 4) * 8;
    drawRazon(ctx, razonX, razonY, 1, sceneProgress < 0.45 ? 'jump' : 'swim', totalTime, {
      scale: 0.92,
      lifeJacket: true,
    });
  } else if (sceneIndex === 4) {
    const rx = w * (0.35 + sceneProgress * 0.22);
    const ry = horizonY + 52 + Math.sin(totalTime * 3.2) * 11;
    drawRazon(ctx, rx, ry, 1, 'swim', totalTime, { scale: 1.15, lifeJacket: true });
  } else if (sceneIndex === 5 || sceneIndex === 6) {
    const beachStart = w * 0.34;
    const sandGrad = ctx.createLinearGradient(beachStart, horizonY, w, h);
    sandGrad.addColorStop(0, '#d4b06a');
    sandGrad.addColorStop(1, '#9c783c');
    ctx.fillStyle = sandGrad;
    ctx.beginPath();
    ctx.moveTo(beachStart, h);
    ctx.quadraticCurveTo(w * 0.46, horizonY + 25, w, horizonY + 12);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    drawPalmTree(ctx, w * 0.78, horizonY + 20, 155, totalTime, 0.2);
    drawPalmTree(ctx, w * 0.9, horizonY + 32, 185, totalTime, -0.18);

    if (sceneIndex === 5) {
      const rx = w * (0.28 + sceneProgress * 0.28);
      const ry = horizonY + 62 + Math.sin(totalTime * 3) * 4;
      drawRazon(ctx, rx, ry, 1, sceneProgress > 0.75 ? 'crouch' : 'swim', totalTime, {
        scale: 1.05,
        lifeJacket: true,
      });
    } else {
      const rx = w * 0.56;
      const ry = horizonY + 58;
      const pose: PlayerPose = sceneProgress < 0.35 ? 'crouch' : 'idle';
      const facing: 1 | -1 = sceneProgress > 0.5 && sceneProgress < 0.75 ? -1 : 1;
      drawRazon(ctx, rx, ry, facing, pose, totalTime, { scale: 1.15 });

      const titleAlpha = Math.min(1, Math.max(0, (sceneProgress - 0.35) * 2.2));
      if (titleAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = titleAlpha;
        ctx.fillStyle = 'rgba(7, 17, 23, 0.6)';
        ctx.fillRect(0, h * 0.14, w, 118);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#f59e0b';
        ctx.font = '700 62px "Bebas Neue", sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 18;
        ctx.fillText('LOST IN SAINT MARTIN', w / 2, h * 0.14 + 66);

        ctx.font = '600 18px "Hind Siliguri", sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText('সেন্ট মার্টিনের নির্জন দ্বীপে বেঁচে থাকার লড়াই', w / 2, h * 0.14 + 98);
        ctx.restore();
      }
    }
  }

  // Foreground translucent waves with white foam crest
  ctx.fillStyle = isStorm ? 'rgba(8, 25, 43, 0.58)' : 'rgba(14, 116, 144, 0.36)';
  ctx.beginPath();
  ctx.moveTo(0, h);
  const waveAmp = isStorm ? 22 : 9;
  const waveFreq = isStorm ? 0.025 : 0.018;
  const waveSpeed = isStorm ? 5.5 : 2.2;
  for (let x = 0; x <= w; x += 20) {
    const wy = horizonY + 72 + Math.sin(x * waveFreq + totalTime * waveSpeed) * waveAmp;
    ctx.lineTo(x, wy);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = isStorm ? 'rgba(226, 232, 240, 0.45)' : 'rgba(240, 249, 255, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 20) {
    const wy = horizonY + 72 + Math.sin(x * waveFreq + totalTime * waveSpeed) * waveAmp;
    if (x === 0) ctx.moveTo(x, wy);
    else ctx.lineTo(x, wy);
  }
  ctx.stroke();

  if (isStorm) {
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const rx = ((i * 97 + totalTime * 520) % (w + 140)) - 70;
      const ry = (i * 63 + totalTime * 900) % h;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 14, ry + 26);
    }
    ctx.stroke();
  }
}

export interface WorldRenderState {
  level: LevelConfig;
  player: {
    x: number;
    y: number;
    facing: 1 | -1;
    pose: PlayerPose;
    animTime: number;
    invulnTimer: number;
  };
  cameraX: number;
  groundY: number;
  objects: WorldObject[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  nearObjectId: string | null;
  time: number;
}

const BIOME_PALETTES: Record<
  BiomeType,
  { skyTop: string; skyBot: string; hillFar: string; hillNear: string; groundTop: string; groundBot: string; sunColor: string }
> = {
  beach: {
    skyTop: '#0369a1',
    skyBot: '#bae6fd',
    hillFar: '#0e7490',
    hillNear: '#155e75',
    groundTop: '#d7b56e',
    groundBot: '#926d35',
    sunColor: '#fef3c7',
  },
  grove: {
    skyTop: '#075985',
    skyBot: '#a7f3d0',
    hillFar: '#166534',
    hillNear: '#14532d',
    groundTop: '#5b8c2a',
    groundBot: '#365314',
    sunColor: '#fef08a',
  },
  spring: {
    skyTop: '#0f766e',
    skyBot: '#ccfbf1',
    hillFar: '#115e59',
    hillNear: '#134e4a',
    groundTop: '#4d7c0f',
    groundBot: '#2e4710',
    sunColor: '#fef9c3',
  },
  camp: {
    skyTop: '#1e3a8a',
    skyBot: '#fdba74',
    hillFar: '#312e81',
    hillNear: '#4338ca',
    groundTop: '#9a6b32',
    groundBot: '#5c3c16',
    sunColor: '#fb923c',
  },
  jungle: {
    skyTop: '#022c22',
    skyBot: '#34d399',
    hillFar: '#064e3b',
    hillNear: '#022c22',
    groundTop: '#365314',
    groundBot: '#1a2e05',
    sunColor: '#d9f99d',
  },
  rocky: {
    skyTop: '#1e293b',
    skyBot: '#f59e0b',
    hillFar: '#334155',
    hillNear: '#1e293b',
    groundTop: '#57534e',
    groundBot: '#292524',
    sunColor: '#fbbf24',
  },
  night: {
    skyTop: '#020617',
    skyBot: '#0f172a',
    hillFar: '#090d16',
    hillNear: '#030712',
    groundTop: '#334155',
    groundBot: '#0f172a',
    sunColor: '#e2e8f0',
  },
};

export function renderGameWorld(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: WorldRenderState
) {
  const { level, player, cameraX, groundY, objects, particles, floatingTexts, nearObjectId, time } =
    state;
  const pal = BIOME_PALETTES[level.biome];

  // 1. Atmospheric Sky
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, pal.skyTop);
  sky.addColorStop(1, pal.skyBot);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  if (level.biome === 'night') {
    ctx.fillStyle = '#f8fafc';
    for (let i = 0; i < 70; i++) {
      const sx = (i * 193) % w;
      const sy = (i * 71) % (groundY * 0.72);
      ctx.globalAlpha = 0.35 + 0.65 * Math.sin(time * 2.5 + i);
      ctx.fillRect(sx, sy, (i % 2) + 1.1, (i % 2) + 1.1);
    }
    ctx.globalAlpha = 1;

    // Moon halo
    const mg = ctx.createRadialGradient(w * 0.84, h * 0.18, 12, w * 0.84, h * 0.18, 70);
    mg.addColorStop(0, 'rgba(241, 245, 249, 0.95)');
    mg.addColorStop(0.45, 'rgba(226, 232, 240, 0.25)');
    mg.addColorStop(1, 'rgba(226, 232, 240, 0)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(w * 0.84, h * 0.18, 70, 0, Math.PI * 2);
    ctx.fill();

    // Sweeping distant lighthouse beam
    const lhX = w * 0.18 - cameraX * 0.1;
    const lhY = groundY - 95;
    ctx.save();
    ctx.translate(lhX, lhY);
    ctx.rotate(Math.sin(time * 0.8) * 0.35);
    const beam = ctx.createLinearGradient(0, 0, 440, 0);
    beam.addColorStop(0, 'rgba(253, 224, 71, 0.28)');
    beam.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(440, -52);
    ctx.lineTo(440, 52);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else {
    // Sun halo + diagonal volumetric rays
    const sx = w * 0.8;
    const sy = h * 0.22;
    const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 125);
    sg.addColorStop(0, pal.sunColor);
    sg.addColorStop(0.35, 'rgba(254, 243, 199, 0.28)');
    sg.addColorStop(1, 'rgba(254, 243, 199, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sx, sy, 125, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant Bay of Bengal water strip
  if (level.biome === 'beach' || level.biome === 'rocky' || level.biome === 'night') {
    const seaGrad = ctx.createLinearGradient(0, groundY - 56, 0, groundY + 4);
    seaGrad.addColorStop(0, level.biome === 'night' ? '#04182a' : '#0284c7');
    seaGrad.addColorStop(1, level.biome === 'night' ? '#082f49' : '#0369a1');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, groundY - 56, w, 60);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let x = -((cameraX * 0.2) % 90); x < w; x += 90) {
      ctx.fillRect(x, groundY - 36 + Math.sin(time * 2 + x) * 2, 48, 1.5);
    }
  }

  // Dual parallax distant islands / coastal ridges
  for (const layer of [
    { speed: 0.16, color: pal.hillFar, base: 52 },
    { speed: 0.3, color: pal.hillNear, base: 32 },
  ]) {
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (let x = 0; x <= w + 50; x += 50) {
      const ws = x + cameraX * layer.speed;
      const hy = groundY - layer.base - Math.sin(ws * 0.0045) * 24 - Math.cos(ws * 0.011) * 10;
      ctx.lineTo(x, hy);
    }
    ctx.lineTo(w, groundY);
    ctx.closePath();
    ctx.fill();
  }

  // Atmospheric horizon mist band
  const mist = ctx.createLinearGradient(0, groundY - 60, 0, groundY + 10);
  mist.addColorStop(0, 'rgba(255,255,255,0)');
  mist.addColorStop(1, level.biome === 'night' ? 'rgba(15,23,42,0.28)' : 'rgba(255,255,255,0.16)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, groundY - 60, w, 70);

  // Midground Swaying Coconut Palms
  const treeSpacing = level.biome === 'jungle' || level.biome === 'grove' ? 210 : 320;
  const firstTree = Math.floor((cameraX * 0.55) / treeSpacing) * treeSpacing - treeSpacing;
  for (let tx = firstTree; tx < cameraX * 0.55 + w + treeSpacing; tx += treeSpacing) {
    const sx = tx - cameraX * 0.55;
    const hTree = 142 + ((Math.abs(tx) * 13) % 52);
    if (level.biome === 'rocky') continue;
    drawPalmTree(ctx, sx, groundY - 10, hTree, time, (tx % 2 === 0 ? 1 : -1) * 0.14);
  }

  // World Space
  ctx.save();
  ctx.translate(-cameraX, 0);

  // Textured Ground
  const gGrad = ctx.createLinearGradient(0, groundY, 0, h);
  gGrad.addColorStop(0, pal.groundTop);
  gGrad.addColorStop(1, pal.groundBot);
  ctx.fillStyle = gGrad;
  ctx.fillRect(cameraX - 20, groundY, w + 40, h - groundY + 20);

  const pat = level.biome === 'rocky' || level.biome === 'night' ? getRockPattern(ctx) : getSandPattern(ctx);
  if (pat) {
    ctx.fillStyle = pat;
    ctx.fillRect(cameraX - 20, groundY, w + 40, h - groundY + 20);
  }

  // Water Zones with reflections & foam
  for (const wz of level.waterZones) {
    ctx.fillStyle = '#082f49';
    ctx.fillRect(wz.x, groundY - 4, wz.w, wz.depth);

    const waterGrad = ctx.createLinearGradient(0, groundY - 8, 0, groundY + wz.depth);
    waterGrad.addColorStop(0, wz.salty ? 'rgba(14, 165, 233, 0.72)' : 'rgba(20, 184, 166, 0.72)');
    waterGrad.addColorStop(1, 'rgba(7, 89, 133, 0.92)');
    ctx.fillStyle = waterGrad;
    ctx.beginPath();
    ctx.moveTo(wz.x, groundY + wz.depth);
    for (let wx = wz.x; wx <= wz.x + wz.w; wx += 12) {
      const waveY = groundY - 6 + Math.sin(wx * 0.08 + time * 4) * 3.5;
      ctx.lineTo(wx, waveY);
    }
    ctx.lineTo(wz.x + wz.w, groundY + wz.depth);
    ctx.closePath();
    ctx.fill();

    // Seafoam crest
    ctx.strokeStyle = 'rgba(240, 249, 255, 0.72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let wx = wz.x; wx <= wz.x + wz.w; wx += 12) {
      const waveY = groundY - 6 + Math.sin(wx * 0.08 + time * 4) * 3.5;
      if (wx === wz.x) ctx.moveTo(wx, waveY);
      else ctx.lineTo(wx, waveY);
    }
    ctx.stroke();
  }

  // Platforms with shading & surface texture
  const rPat = getRockPattern(ctx);
  for (const p of level.platforms) {
    const py = groundY + p.y;
    const pGrad = ctx.createLinearGradient(p.x, py, p.x, py + p.h);
    if (p.kind === 'coral' || p.kind === 'cliff') {
      pGrad.addColorStop(0, p.kind === 'cliff' ? '#57534e' : '#78716c');
      pGrad.addColorStop(1, '#292524');
    } else if (p.kind === 'wood' || p.kind === 'branch') {
      pGrad.addColorStop(0, '#854d0e');
      pGrad.addColorStop(1, '#451a03');
    } else if (p.kind === 'moss') {
      pGrad.addColorStop(0, '#4d7c0f');
      pGrad.addColorStop(1, '#1a2e05');
    } else {
      pGrad.addColorStop(0, '#d7b56e');
      pGrad.addColorStop(1, '#854d0e');
    }
    ctx.fillStyle = pGrad;
    roundedRect(ctx, p.x, py, p.w, p.h, 5);
    ctx.fill();
    if (rPat && (p.kind === 'coral' || p.kind === 'cliff')) {
      ctx.fillStyle = rPat;
      roundedRect(ctx, p.x, py, p.w, p.h, 5);
      ctx.fill();
    }
    // Top rim highlight
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(p.x + 4, py + 1, p.w - 8, 2.5);
  }

  // Climbable Vines, Ladders & Cliff Ropes
  for (const cz of level.climbZones ?? []) {
    const cx = cz.x + cz.w / 2;
    const top = groundY + cz.topY;
    const bot = groundY + cz.bottomY;
    if (cz.kind === 'ladder') {
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx - 10, top);
      ctx.lineTo(cx - 10, bot);
      ctx.moveTo(cx + 10, top);
      ctx.lineTo(cx + 10, bot);
      ctx.stroke();
      ctx.lineWidth = 3;
      for (let ry = top + 10; ry < bot - 4; ry += 14) {
        ctx.beginPath();
        ctx.moveTo(cx - 10, ry);
        ctx.lineTo(cx + 10, ry);
        ctx.stroke();
      }
    } else if (cz.kind === 'vine') {
      ctx.strokeStyle = '#166534';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(cx, top);
      for (let vy = top; vy <= bot; vy += 14) {
        ctx.lineTo(cx + Math.sin(vy * 0.1 + time * 1.5) * 4, vy);
      }
      ctx.stroke();
      ctx.fillStyle = '#22c55e';
      for (let vy = top + 14; vy < bot - 8; vy += 20) {
        ctx.beginPath();
        ctx.ellipse(cx + 6, vy, 5, 2.5, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Braided cliff rope
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.lineTo(cx, bot);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      for (let vy = top + 12; vy < bot - 6; vy += 18) {
        ctx.beginPath();
        ctx.arc(cx, vy, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // World Objects & Hazards
  for (const obj of objects) {
    if (obj.collected) continue;
    const ox = obj.x;
    const oy = groundY + obj.y;
    const isNear = obj.id === nearObjectId;

    if (isNear) {
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ox + obj.w / 2, oy + obj.h / 2, Math.max(obj.w, obj.h) * 0.58 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    switch (obj.kind) {
      case 'coconut': {
        const cg = ctx.createRadialGradient(ox + 10, oy + 10, 2, ox + 14, oy + 14, 13);
        cg.addColorStop(0, '#84cc16');
        cg.addColorStop(0.6, '#4d7c0f');
        cg.addColorStop(1, '#1a2e05');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(ox + 14, oy + 14, 11.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'water_bottle': {
        ctx.fillStyle = 'rgba(186, 230, 253, 0.85)';
        roundedRect(ctx, ox + 5, oy + 6, 15, 24, 4);
        ctx.fill();
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(ox + 6, oy + 14, 13, 8);
        ctx.fillRect(ox + 9, oy + 1, 7, 5);
        break;
      }
      case 'fresh_spring': {
        ctx.fillStyle = '#44403c';
        roundedRect(ctx, ox, oy + 28, obj.w, 28, 8);
        ctx.fill();
        ctx.fillStyle = '#0891b2';
        ctx.beginPath();
        ctx.ellipse(ox + obj.w / 2, oy + 38, obj.w * 0.38, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(165, 243, 252, 0.72)';
        ctx.fillRect(ox + obj.w / 2 - 3.5, oy + Math.sin(time * 8) * 3, 7, 36);
        break;
      }
      case 'wood': {
        ctx.fillStyle = '#5c341f';
        roundedRect(ctx, ox, oy + 6, obj.w, 11, 3);
        ctx.fill();
        ctx.fillStyle = '#854d0e';
        ctx.fillRect(ox + 4, oy + 8, obj.w - 8, 3);
        break;
      }
      case 'frond': {
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.ellipse(ox + 21, oy + 13, 20, 7, -0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#65a30d';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(ox + 3, oy + 16);
        ctx.lineTo(ox + 39, oy + 9);
        ctx.stroke();
        break;
      }
      case 'flare_crate': {
        ctx.fillStyle = '#7f1d1d';
        roundedRect(ctx, ox, oy + 6, obj.w, obj.h - 6, 4);
        ctx.fill();
        ctx.fillStyle = '#eab308';
        ctx.fillRect(ox + 6, oy + 18, obj.w - 12, 5);
        break;
      }
      case 'safe_spot': {
        ctx.fillStyle = '#5c341f';
        ctx.fillRect(ox + obj.w / 2 - 3.5, oy + 20, 7, obj.h - 20);
        const lg = ctx.createRadialGradient(
          ox + obj.w / 2,
          oy + 22,
          3,
          ox + obj.w / 2,
          oy + 22,
          28
        );
        lg.addColorStop(0, 'rgba(254, 243, 199, 0.95)');
        lg.addColorStop(0.5, 'rgba(245, 158, 11, 0.45)');
        lg.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(ox + obj.w / 2, oy + 22, 28, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'reconnect_spot': {
        const cx = ox + obj.w / 2;
        const cy = oy + 26;
        // High-ground satellite reception zone marker
        ctx.fillStyle = obj.activated ? '#10b981' : '#0ea5e9';
        ctx.fillRect(cx - 2.5, cy + 4, 5, obj.h - 30);
        const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 32);
        glow.addColorStop(0, obj.activated ? 'rgba(52, 211, 153, 0.85)' : 'rgba(56, 189, 248, 0.9)');
        glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, 32, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing satellite signal arcs
        for (let r = 0; r < 3; r++) {
          const pulse = (time * 1.4 + r * 0.33) % 1;
          ctx.strokeStyle = obj.activated
            ? `rgba(52, 211, 153, ${0.8 * (1 - pulse)})`
            : `rgba(34, 211, 238, ${0.85 * (1 - pulse)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 8 + pulse * 24, -Math.PI * 0.85, -Math.PI * 0.15);
          ctx.stroke();
        }
        break;
      }
      case 'shelter_site': {
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(ox + 8, oy + obj.h - 38, 22, 38);
        if (obj.activated) {
          ctx.fillStyle = '#5c341f';
          ctx.fillRect(ox + 36, oy + 32, 8, obj.h - 32);
          ctx.fillRect(ox + 118, oy + 32, 8, obj.h - 32);
          ctx.fillStyle = '#365314';
          ctx.beginPath();
          ctx.moveTo(ox + 20, oy + 42);
          ctx.lineTo(ox + 82, oy + 2);
          ctx.lineTo(ox + 144, oy + 42);
          ctx.closePath();
          ctx.fill();
          drawCampfire(ctx, ox + 16, oy + obj.h, time);
        } else {
          ctx.strokeStyle = 'rgba(217, 119, 6, 0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(ox + 38, oy + 34, 88, obj.h - 34);
          ctx.setLineDash([]);
        }
        break;
      }
      case 'signal_beacon': {
        ctx.fillStyle = '#44403c';
        roundedRect(ctx, ox + 20, oy + obj.h - 18, 64, 18, 4);
        ctx.fill();
        if (obj.activated) {
          drawCampfire(ctx, ox + 52, oy + obj.h - 14, time, 1.8);
          const flareY = oy - ((time * 95) % 240);
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(ox + 52, flareY, 7, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#78350f';
          ctx.fillRect(ox + 34, oy + obj.h - 30, 36, 12);
        }
        break;
      }
      case 'crab': {
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.ellipse(ox + 17, oy + 15, 12, 7.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ox + 6, oy + 11);
        ctx.lineTo(ox + 1, oy + 3);
        ctx.moveTo(ox + 28, oy + 11);
        ctx.lineTo(ox + 33, oy + 3);
        ctx.stroke();
        break;
      }
      case 'thorns': {
        ctx.fillStyle = '#1a2e05';
        ctx.beginPath();
        ctx.ellipse(ox + obj.w / 2, oy + obj.h - 8, obj.w * 0.5, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 1.8;
        for (let sx = ox + 6; sx < ox + obj.w - 4; sx += 10) {
          ctx.beginPath();
          ctx.moveTo(sx, oy + obj.h - 14);
          ctx.lineTo(sx + 3, oy + 2);
          ctx.stroke();
        }
        break;
      }
      case 'sharp_coral': {
        ctx.fillStyle = '#881337';
        ctx.beginPath();
        ctx.moveTo(ox, oy + obj.h);
        ctx.lineTo(ox + obj.w * 0.28, oy);
        ctx.lineTo(ox + obj.w * 0.5, oy + obj.h * 0.5);
        ctx.lineTo(ox + obj.w * 0.78, oy + 4);
        ctx.lineTo(ox + obj.w, oy + obj.h);
        ctx.closePath();
        ctx.fill();
        break;
      }
    }
  }

  // Player (Razon)
  drawRazon(ctx, player.x, player.y, player.facing, player.pose, player.animTime, {
    hurtFlash: player.invulnTimer > 0,
  });

  // Particles
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha * (p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Subtle floating item numbers (+১)
  for (const ft of floatingTexts) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, ft.life / ft.maxLife + 0.15);
    ctx.font = '700 13px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  ctx.restore();
}

function drawCampfire(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  scale = 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const glow = ctx.createRadialGradient(0, -18, 4, 0, -18, 48);
  glow.addColorStop(0, 'rgba(251, 146, 60, 0.45)');
  glow.addColorStop(1, 'rgba(251, 146, 60, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -18, 48, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#451a03';
  ctx.fillRect(-14, -6, 28, 6);

  const flicker = Math.sin(time * 16) * 3;
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(-10, -4);
  ctx.quadraticCurveTo(-7, -26 - flicker, 0, -34 - flicker);
  ctx.quadraticCurveTo(7, -24 + flicker, 10, -4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.moveTo(-5, -4);
  ctx.quadraticCurveTo(0, -21 + flicker, 5, -4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export type EndingAnimationStage = 'approaching' | 'dialogue' | 'departing' | 'complete';

export function renderEndingScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  stage: EndingAnimationStage,
  stageTime: number,
  elapsed: number,
  time: number
) {
  // Smooth dawn progress driven by stage so sky brightens into golden sunrise as Rasel arrives & departs
  const dawnBlend =
    stage === 'approaching'
      ? Math.min(0.45, (stageTime / 4.2) * 0.45)
      : stage === 'dialogue'
      ? 0.45 + Math.min(0.3, (stageTime / 6) * 0.3)
      : Math.min(1, 0.75 + stageTime * 0.08);

  // 1. Dawn Sky Gradient
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.72);
  if (dawnBlend < 0.4) {
    sky.addColorStop(0, '#04091a');
    sky.addColorStop(0.55, '#172554');
    sky.addColorStop(1, '#c2410c');
  } else if (dawnBlend < 0.78) {
    sky.addColorStop(0, '#1e3a8a');
    sky.addColorStop(0.5, '#c2410c');
    sky.addColorStop(1, '#fbbf24');
  } else {
    sky.addColorStop(0, '#0284c7');
    sky.addColorStop(0.45, '#f59e0b');
    sky.addColorStop(1, '#fef08a');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Fading stars during early dawn
  if (dawnBlend < 0.7) {
    ctx.fillStyle = '#f8fafc';
    const starFade = Math.max(0, 1 - dawnBlend * 1.4);
    for (let i = 0; i < 42; i++) {
      const sx = (i * 173) % w;
      const sy = (i * 59) % (h * 0.45);
      ctx.globalAlpha = starFade * (0.4 + 0.5 * Math.sin(time * 3 + i));
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }

  // Rising Sun + Volumetric Dawn Rays
  const sunX = w * 0.78;
  const sunY = h * (0.68 - dawnBlend * 0.28);
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 180);
  sunGlow.addColorStop(0, 'rgba(254, 249, 195, 0.96)');
  sunGlow.addColorStop(0.28, 'rgba(251, 191, 36, 0.55)');
  sunGlow.addColorStop(1, 'rgba(251, 146, 60, 0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 180, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(sunX, sunY);
  ctx.globalAlpha = 0.09 + dawnBlend * 0.1;
  for (let r = 0; r < 9; r++) {
    const angle = -Math.PI + (r / 8) * Math.PI + Math.sin(time * 0.4 + r) * 0.03;
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle - 0.06) * w, Math.sin(angle - 0.06) * w);
    ctx.lineTo(Math.cos(angle + 0.06) * w, Math.sin(angle + 0.06) * w);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 2. Shimmering Bay of Bengal + Distant Saint Martin Silhouette
  const seaY = h * 0.66;
  const seaGrad = ctx.createLinearGradient(0, seaY, 0, h);
  seaGrad.addColorStop(0, dawnBlend > 0.5 ? '#0369a1' : '#082f49');
  seaGrad.addColorStop(1, '#04182a');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, seaY, w, h - seaY);

  // Sun reflection shimmer on ocean
  ctx.fillStyle = 'rgba(253, 224, 71, 0.34)';
  for (let i = 0; i < 14; i++) {
    const ry = seaY + 6 + i * ((h - seaY) / 16);
    const widthFactor = 18 + i * 5 + Math.sin(time * 3.4 + i) * 10;
    const rx = sunX - widthFactor / 2 + Math.sin(time * 2 + i) * 8;
    ctx.fillRect(rx, ry, widthFactor, 2.2);
  }

  // 3. Rocky Rescue Cliff + Palms
  const cliffY = h * 0.72;
  const cliffW = w * 0.66;
  const cliffGrad = ctx.createLinearGradient(0, cliffY, 0, h);
  cliffGrad.addColorStop(0, '#44403c');
  cliffGrad.addColorStop(1, '#1c1917');
  ctx.fillStyle = cliffGrad;
  ctx.beginPath();
  ctx.moveTo(0, cliffY);
  ctx.lineTo(cliffW * 0.92, cliffY);
  ctx.quadraticCurveTo(cliffW, cliffY + 8, cliffW * 0.96, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#78716c';
  ctx.fillRect(0, cliffY, cliffW * 0.92, 5);

  drawPalmTree(ctx, w * 0.1, cliffY + 2, 130, time, 0.16);
  drawPalmTree(ctx, w * 0.2, cliffY + 4, 105, time, -0.14);

  // Signal bonfire + rising embers
  const fireX = w * 0.26;
  drawCampfire(ctx, fireX, cliffY, time, 1.55);
  for (let e = 0; e < 10; e++) {
    const cycle = (time * 0.9 + e * 0.23) % 1;
    const ex = fireX + Math.sin(time * 4 + e * 2.1) * 14;
    const ey = cliffY - 22 - cycle * 95;
    ctx.fillStyle = e % 3 === 0 ? '#ef4444' : '#fbbf24';
    ctx.globalAlpha = 1 - cycle;
    ctx.beginPath();
    ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 4. Stage-Synced Helicopter + Boarding Choreography
  let heliX = w * 0.58;
  let heliY = h * 0.44;
  let heliTilt = -0.05;
  let showRazonOnGround = true;
  let razonX = w * 0.36;
  let razonPose: PlayerPose = 'idle';
  let ladderDrop = 0;
  let doorOpen = true;

  if (stage === 'approaching') {
    const t = Math.min(1, stageTime / 4.2);
    const ease = 1 - Math.pow(1 - t, 3);
    heliX = w * (1.16 - ease * 0.58);
    heliY = h * (0.14 + ease * 0.31) + Math.sin(time * 2.5) * 3;
    heliTilt = -0.14 * (1 - ease);
    ladderDrop = Math.max(0, (t - 0.6) / 0.4);
    razonPose = t > 0.5 ? 'interact' : 'idle';
  } else if (stage === 'dialogue') {
    heliX = w * 0.58 + Math.sin(time * 1.8) * 3;
    heliY = h * 0.45 + Math.sin(time * 3.1) * 3.5;
    heliTilt = Math.sin(time * 1.4) * 0.02;
    ladderDrop = 1;
    // Razon starts running toward the rope ladder after 1.6s of dialogue
    if (stageTime > 1.6) {
      const walkT = Math.min(1, (stageTime - 1.6) / 2.0);
      razonX = w * (0.36 + walkT * 0.2);
      if (walkT < 1) {
        razonPose = 'run';
      } else {
        showRazonOnGround = false;
      }
    } else {
      razonPose = 'interact';
    }
  } else if (stage === 'departing') {
    showRazonOnGround = false;
    const t = Math.min(1, stageTime / 5.4);
    const easeIn = t * t * (3 - 2 * t);
    heliX = w * (0.58 + easeIn * 0.65);
    heliY = h * (0.45 - easeIn * 0.38) + Math.sin(time * 3.5) * 2;
    heliTilt = 0.14 * Math.sin(Math.min(1, t * 2) * Math.PI * 0.5);
    ladderDrop = Math.max(0, 1 - t * 2.5);
    doorOpen = t < 0.25;
  } else {
    // 'complete': helicopter glides high across the golden sunrise horizon
    showRazonOnGround = false;
    const loopX = ((stageTime * 0.12) % 1.4) - 0.2;
    heliX = w * loopX;
    heliY = h * 0.2 + Math.sin(time * 2) * 5;
    heliTilt = 0.08;
    doorOpen = false;
  }

  // Downwash dust mist when hovering near cliff
  if (stage === 'approaching' || stage === 'dialogue' || (stage === 'departing' && stageTime < 1.5)) {
    ctx.fillStyle = 'rgba(254, 243, 199, 0.22)';
    for (let d = 0; d < 8; d++) {
      const spread = ((time * 90 + d * 24) % 130) - 65;
      ctx.beginPath();
      ctx.ellipse(heliX + spread, cliffY - 2, 18, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw Razon on the cliff before boarding
  if (showRazonOnGround) {
    drawRazon(ctx, razonX, cliffY, 1, razonPose, time, { scale: 1.05 });
  }

  // Draw Helicopter
  ctx.save();
  ctx.translate(heliX, heliY);
  ctx.rotate(heliTilt);
  if (stage === 'complete') ctx.scale(0.62, 0.62);

  // Searchlight cone
  if (stage === 'approaching' || stage === 'dialogue') {
    const beam = ctx.createLinearGradient(0, 22, -65, 190);
    beam.addColorStop(0, 'rgba(254, 249, 195, 0.38)');
    beam.addColorStop(1, 'rgba(254, 249, 195, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-24, 22);
    ctx.lineTo(-140, 200);
    ctx.lineTo(30, 200);
    ctx.closePath();
    ctx.fill();
  }

  // Boarding Rope Ladder
  if (ladderDrop > 0.02) {
    const ropeLen = (cliffY - heliY - 12) * ladderDrop;
    if (ropeLen > 8) {
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-4, 26);
      ctx.lineTo(-4, 26 + ropeLen);
      ctx.moveTo(14, 26);
      ctx.lineTo(14, 26 + ropeLen);
      ctx.stroke();
      for (let ry = 38; ry < 26 + ropeLen - 6; ry += 16) {
        ctx.beginPath();
        ctx.moveTo(-4, ry);
        ctx.lineTo(14, ry);
        ctx.stroke();
      }
    }
  }

  // Tail boom + spinning tail rotor
  const tailGrad = ctx.createLinearGradient(36, -16, 136, -2);
  tailGrad.addColorStop(0, '#e2e8f0');
  tailGrad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = tailGrad;
  ctx.beginPath();
  ctx.moveTo(36, -16);
  ctx.lineTo(136, -11);
  ctx.lineTo(136, -2);
  ctx.lineTo(36, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(118, -36);
  ctx.lineTo(136, -34);
  ctx.lineTo(139, -2);
  ctx.lineTo(120, -2);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.translate(136, -22);
  ctx.rotate(time * 32);
  ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
  ctx.fillRect(-2, -17, 4, 34);
  ctx.fillRect(-17, -2, 34, 4);
  ctx.restore();

  // Landing skids
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-54, 40);
  ctx.lineTo(48, 40);
  ctx.moveTo(-60, 35);
  ctx.lineTo(-54, 40);
  ctx.moveTo(-28, 22);
  ctx.lineTo(-32, 40);
  ctx.moveTo(24, 22);
  ctx.lineTo(28, 40);
  ctx.stroke();

  // Fuselage (taller rescue cabin so characters sit naturally below roof & rotor)
  const bodyGrad = ctx.createLinearGradient(0, -35, 0, 27);
  bodyGrad.addColorStop(0, '#ffffff');
  bodyGrad.addColorStop(0.55, '#e2e8f0');
  bodyGrad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = bodyGrad;
  roundedRect(ctx, -74, -35, 134, 61, 24);
  ctx.fill();

  // Rescue orange-red livery stripe
  ctx.fillStyle = '#ea580c';
  roundedRect(ctx, -70, 6, 126, 18, 9);
  ctx.fill();

  // Front Cockpit Windshield
  const glassGrad = ctx.createLinearGradient(-70, -28, -22, 5);
  glassGrad.addColorStop(0, '#bae6fd');
  glassGrad.addColorStop(1, '#0284c7');
  ctx.fillStyle = glassGrad;
  ctx.beginPath();
  ctx.arc(-38, -7, 22, Math.PI * 0.78, Math.PI * 1.66);
  ctx.lineTo(-22, -2);
  ctx.closePath();
  ctx.fill();

  // Open Rescue Cabin Door + Rasel Vai leaning out from doorway (safely below roof & rotor!)
  ctx.fillStyle = doorOpen ? '#090d16' : '#38bdf8';
  roundedRect(ctx, -12, -25, 48, 45, 5);
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(-12, -25, 48, 45);

  if (doorOpen) {
    if (!showRazonOnGround) {
      drawRazon(ctx, 24, 18, -1, 'crouch', time, { scale: 0.48 });
    }
    drawRaselVaiLeaning(ctx, 10, 19, time, stage !== 'departing');
  }

  // Main Rotor Mast + Motion-Blur Disc + Spinning Blades (well above cabin roof)
  ctx.fillStyle = '#334155';
  ctx.fillRect(-6, -52, 12, 18);
  ctx.fillStyle = 'rgba(226, 232, 240, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, -52, 160, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const bladeWidth = 28 + Math.abs(Math.sin(time * 32)) * 150;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-bladeWidth, -53.5, bladeWidth * 2, 3.2);

  ctx.restore();

  // 5. Golden Celebration Sparkles / Confetti during MISSION COMPLETE
  if (stage === 'complete') {
    for (let c = 0; c < 36; c++) {
      const cx = ((c * 97 + Math.sin(time * 1.3 + c) * 32) % w + w) % w;
      const cy = ((c * 53 + time * (28 + (c % 4) * 10)) % h);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 2.5 + c);
      ctx.fillStyle = c % 3 === 0 ? '#fbbf24' : c % 3 === 1 ? '#34d399' : '#38bdf8';
      ctx.globalAlpha = 0.78;
      ctx.fillRect(-3, -1.5, 6, 3);
      ctx.restore();
    }
  }
}

export interface PhoneCallSceneState {
  biome: 'beach' | 'grove';
  phonePose: 'check' | 'ear' | 'raise';
  mood: 'worried' | 'tired' | 'smile' | 'annoyed';
  talking: boolean;
  signalBars: 0 | 1 | 2 | 3;
  time: number;
}

export function renderPhoneCallScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: PhoneCallSceneState
) {
  const { biome, phonePose, mood, talking, signalBars, time } = state;
  ctx.clearRect(0, 0, w, h);

  const isPortrait = w < h;
  const horizonY = isPortrait ? h * 0.48 : h * 0.6;
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  if (biome === 'beach') {
    sky.addColorStop(0, '#075985');
    sky.addColorStop(0.6, '#38bdf8');
    sky.addColorStop(1, '#fde68a');
  } else {
    sky.addColorStop(0, '#064e3b');
    sky.addColorStop(0.55, '#0284c7');
    sky.addColorStop(1, '#bbf7d0');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Warm sun glow
  const sunX = w * 0.22;
  const sunY = h * 0.22;
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 140);
  glow.addColorStop(0, 'rgba(254, 249, 195, 0.92)');
  glow.addColorStop(0.35, 'rgba(253, 224, 71, 0.35)');
  glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 140, 0, Math.PI * 2);
  ctx.fill();

  // Distant ocean & Saint Martin ridge
  const sea = ctx.createLinearGradient(0, horizonY, 0, h);
  sea.addColorStop(0, '#0284c7');
  sea.addColorStop(1, '#0c4a6e');
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  const groundY = isPortrait ? h * 0.63 : h * 0.78;
  if (biome === 'beach') {
    const sand = ctx.createLinearGradient(0, groundY - 12, 0, h);
    sand.addColorStop(0, '#e5c17b');
    sand.addColorStop(1, '#9a7438');
    ctx.fillStyle = sand;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 12);
    ctx.quadraticCurveTo(w * 0.4, groundY - 20, w, groundY + 4);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  } else {
    // Elevated wooden tree-branch overlook in the coconut grove
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.ellipse(isPortrait ? w * 0.5 : w * 0.22, groundY + 26, w * 0.34, 90, 0, 0, Math.PI * 2);
    ctx.fill();

    const branchGrad = ctx.createLinearGradient(0, groundY - 4, 0, groundY + 34);
    branchGrad.addColorStop(0, '#78350f');
    branchGrad.addColorStop(1, '#451a03');
    ctx.fillStyle = branchGrad;
    roundedRect(ctx, isPortrait ? w * 0.14 : w * 0.04, groundY - 2, isPortrait ? w * 0.72 : w * 0.52, 26, 12);
    ctx.fill();
  }

  drawPalmTree(ctx, w * 0.11, groundY + 6, isPortrait ? 145 : 175, time, 0.22);
  drawPalmTree(ctx, w * 0.89, groundY + 20, isPortrait ? 140 : 165, time, -0.2);

  // Portrait: centered above bottom dialogue card; Landscape: left of handset card
  const razonX = isPortrait ? w * 0.48 : w * 0.26;
  const razonY = groundY;
  const scale = isPortrait ? Math.max(1.45, Math.min(1.85, w / 280)) : Math.max(1.6, Math.min(2.05, h / 230));

  drawRazon(ctx, razonX, razonY, 1, 'idle', time, {
    scale,
    phonePose,
    mood,
    talking,
    phoneSignal: signalBars,
  });
}
