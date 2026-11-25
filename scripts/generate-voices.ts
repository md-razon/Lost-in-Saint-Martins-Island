import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import {
  CALL_1_LINES,
  CALL_2_LINES,
  CONTEXTUAL_DIALOGUES,
  INTRO_SCENES,
  LEVELS,
  STORY_EVENT_LINES,
} from '../src/game/levels';
import { VoiceEmotion } from '../src/game/types';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_AUDIO_DIR = path.join(ROOT_DIR, 'public', 'assets', 'audio', 'voices');
const MANIFEST_PATH = path.join(ROOT_DIR, 'src', 'game', 'voiceManifest.ts');

type SpeakerRole = 'narrator' | 'razon' | 'rasel';

interface VoiceSpec {
  id: string;
  speaker: SpeakerRole;
  emotion: VoiceEmotion;
  textBn: string;
}

// Keep pitch near 0Hz so Edge Neural TTS does NOT introduce vocoder buzz/robotic artifacts!
const BASE_PROFILES: Record<
  SpeakerRole,
  { voice: string; rateBase: number; pitchBase: number; volBase: number }
> = {
  razon: {
    voice: 'bn-BD-PradeepNeural',
    rateBase: 1,
    pitchBase: 0,
    volBase: 0,
  },
  rasel: {
    voice: 'bn-IN-BashkarNeural',
    rateBase: -2,
    pitchBase: 0,
    volBase: 0,
  },
  narrator: {
    voice: 'bn-BD-PradeepNeural',
    rateBase: -4,
    pitchBase: -1,
    volBase: -2,
  },
};

function formatSigned(val: number, unit: '%' | 'Hz') {
  const rounded = Math.round(val);
  return `${rounded >= 0 ? '+' : ''}${rounded}${unit}`;
}

// Only split genuinely long multi-sentence lines (> 75 chars) so short sentences keep natural single-breath prosody
function splitIntoNaturalSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= 75) return [cleaned];

  const parts = cleaned
    .split(/(?<=[।!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length <= 1) return [cleaned];

  const merged: string[] = [];
  for (const part of parts) {
    if (merged.length > 0 && (part.length < 18 || merged[merged.length - 1].length < 18)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${part}`;
    } else {
      merged.push(part);
    }
  }
  return merged.slice(0, 2);
}

function getNaturalProsody(
  speaker: SpeakerRole,
  emotion: VoiceEmotion,
  idx: number
) {
  const base = BASE_PROFILES[speaker];
  let rate = base.rateBase;
  let pitch = base.pitchBase;
  let vol = base.volBase;

  switch (emotion) {
    case 'funny':
      rate += idx === 0 ? 4 : 5;
      pitch += 2;
      vol += 1;
      break;
    case 'suspense':
      rate -= 7;
      pitch -= 2;
      vol -= 5;
      break;
    case 'fear':
      rate += 7;
      pitch += 2;
      vol += 0;
      break;
    case 'surprise':
      rate += 5;
      pitch += 2;
      vol += 2;
      break;
    case 'normal':
    default:
      rate += 0;
      pitch += 0;
      break;
  }

  // Strictly clamp pitch to [-2Hz, +2Hz] to avoid ANY neural vocoder robotic artifacts!
  return {
    rate: formatSigned(Math.max(-12, Math.min(12, rate)), '%'),
    pitch: formatSigned(Math.max(-2, Math.min(2, pitch)), 'Hz'),
    volume: formatSigned(Math.max(-10, Math.min(6, vol)), '%'),
  };
}

async function synthesizeEdgeClause(
  voice: string,
  text: string,
  prosody: { rate: string; pitch: string; volume: string }
): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text, prosody);
      const chunks: Buffer[] = [];
      await Promise.race([
        (async () => {
          for await (const chunk of audioStream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
        })(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Neural TTS timeout')), 12000)
        ),
      ]);
      const buf = Buffer.concat(chunks);
      if (buf.length > 200) return buf;
    } catch {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    } finally {
      try {
        tts.close();
      } catch {
        // Ignore close errors
      }
    }
  }
  return null;
}

// Clean studio mastering ONLY — NO tremolo, NO comb-filter aecho, NO harsh distortion
async function masterCleanStudioAudio(
  sentenceBuffers: Buffer[],
  emotion: VoiceEmotion,
  speaker: SpeakerRole
): Promise<Buffer> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm_clean_'));
  try {
    const inputPaths: string[] = [];
    for (let i = 0; i < sentenceBuffers.length; i++) {
      const p = path.join(workDir, `s_${i}.mp3`);
      fs.writeFileSync(p, sentenceBuffers[i]);
      inputPaths.push(p);
    }

    const outPath = path.join(workDir, 'master.mp3');
    const gapSec = emotion === 'suspense' ? 0.28 : emotion === 'fear' ? 0.14 : 0.16;

    const args: string[] = ['-y'];
    for (const p of inputPaths) {
      args.push('-i', p);
    }

    const filterParts: string[] = [];
    const concatRefs: string[] = [];

    for (let i = 0; i < inputPaths.length; i++) {
      concatRefs.push(`[${i}:a]`);
      if (i < inputPaths.length - 1) {
        filterParts.push(
          `anullsrc=r=24000:cl=mono:d=${gapSec.toFixed(2)}[sil${i}]`
        );
        concatRefs.push(`[sil${i}]`);
      }
    }

    const nSegs = concatRefs.length;
    filterParts.push(`${concatRefs.join('')}concat=n=${nSegs}:v=0:a=1[joined]`);

    // Gentle clean broadcast EQ (warm chest for Rasel, crisp friendly presence for Razon)
    let chain = 'aresample=24000,highpass=f=80,lowpass=f=8500';
    if (speaker === 'rasel') {
      chain += ',equalizer=f=150:t=q:w=1.1:g=2.4,equalizer=f=2400:t=q:w=1.4:g=1.0';
    } else if (emotion === 'suspense') {
      chain += ',equalizer=f=165:t=q:w=1.2:g=2.0,equalizer=f=4500:t=q:w=1.2:g=-1.2';
    } else {
      chain += ',equalizer=f=220:t=q:w=1.2:g=1.2,equalizer=f=3000:t=q:w=1.4:g=1.2';
    }
    chain += ',acompressor=threshold=-20dB:ratio=2.2:attack=14:release=140,volume=1.06';

    filterParts.push(`[joined]${chain}[out]`);
    args.push(
      '-filter_complex',
      filterParts.join(';'),
      '-map',
      '[out]',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '96k',
      '-ar',
      '24000',
      '-ac',
      '1',
      outPath
    );

    await execFileAsync('ffmpeg', args, { timeout: 10000 });
    const mastered = fs.readFileSync(outPath);
    if (mastered.length > 256) return mastered;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  return Buffer.concat(sentenceBuffers);
}

async function generateClip(spec: VoiceSpec): Promise<Buffer> {
  const base = BASE_PROFILES[spec.speaker];
  const sentences = splitIntoNaturalSentences(spec.textBn);
  const buffers: Buffer[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const buf = await synthesizeEdgeClause(
      base.voice,
      sentences[i],
      getNaturalProsody(spec.speaker, spec.emotion, i)
    );
    if (!buf) {
      throw new Error(`Failed sentence for ${spec.id}: "${sentences[i]}"`);
    }
    buffers.push(buf);
  }
  return masterCleanStudioAudio(buffers, spec.emotion, spec.speaker);
}

function collectSpecs(): VoiceSpec[] {
  const specs: VoiceSpec[] = [];

  for (const sc of INTRO_SCENES) {
    specs.push({
      id: `intro_${sc.id}`,
      speaker: sc.speakerBn === 'রাজন' ? 'razon' : 'narrator',
      emotion: sc.emotion,
      textBn: sc.textBn,
    });
  }

  CALL_1_LINES.forEach((line, idx) => {
    specs.push({
      id: `call1_${String(idx + 1).padStart(2, '0')}`,
      speaker: line.speaker,
      emotion: line.emotion,
      textBn: line.textBn,
    });
  });

  CALL_2_LINES.forEach((line, idx) => {
    specs.push({
      id: `call2_${String(idx + 1).padStart(2, '0')}`,
      speaker: line.speaker,
      emotion: line.emotion,
      textBn: line.textBn,
    });
  });

  for (const lvl of LEVELS) {
    if (lvl.storyIntroBn) {
      specs.push({
        id: `lvl${lvl.id}_story_intro`,
        speaker: 'narrator',
        emotion: lvl.storyIntroEmotion ?? 'suspense',
        textBn: lvl.storyIntroBn,
      });
    }
    specs.push({
      id: `lvl${lvl.id}_intro`,
      speaker: 'razon',
      emotion: lvl.introEmotion ?? 'normal',
      textBn: lvl.introLineBn,
    });
    if (lvl.storyBeatBn) {
      specs.push({
        id: `lvl${lvl.id}_story_beat`,
        speaker: 'narrator',
        emotion: lvl.storyBeatEmotion ?? 'suspense',
        textBn: lvl.storyBeatBn,
      });
    }
    specs.push({
      id: `lvl${lvl.id}_complete`,
      speaker: 'razon',
      emotion: lvl.completeEmotion ?? 'normal',
      textBn: lvl.completeLineBn,
    });
    for (const obj of lvl.objects) {
      if (obj.subtitleBn) {
        specs.push({
          id: `${obj.id}_sub`,
          speaker: 'razon',
          emotion: obj.kind === 'flare_crate' ? 'surprise' : 'normal',
          textBn: obj.subtitleBn,
        });
      }
    }
  }

  for (const [key, item] of Object.entries(STORY_EVENT_LINES)) {
    specs.push({
      id: `story_${key}`,
      speaker: item.speaker,
      emotion: item.emotion,
      textBn: item.textBn,
    });
  }

  specs.push(
    {
      id: 'warn_shelter_materials',
      speaker: 'razon',
      emotion: 'normal',
      textBn: 'আগে ৩টি কাঠ আর ৩টি নারকেল পাতা জোগাড় করতে হবে!',
    },
    {
      id: 'warn_beacon_wood',
      speaker: 'razon',
      emotion: 'fear',
      textBn: 'আগুন জ্বালাতে আরও শুকনো কাঠ লাগবে!',
    },
    {
      id: 'ending_1',
      speaker: 'rasel',
      emotion: 'surprise',
      textBn: 'রাজন! অবশেষে তোমায় পেলাম ভাই! তাড়াতাড়ি হাত ধরো, হেলিকপ্টারে ওঠো!',
    },
    {
      id: 'ending_2',
      speaker: 'rasel',
      emotion: 'normal',
      textBn: 'সব ভয় শেষ। সেন্ট মার্টিন পেছনে ফেলে আমরা এখন বাড়ি ফিরছি!',
    }
  );

  for (const items of Object.values(CONTEXTUAL_DIALOGUES)) {
    for (const item of items) {
      specs.push({
        id: `ctx_${item.id}`,
        speaker: 'razon',
        emotion: item.emotion,
        textBn: item.textBn,
      });
    }
  }

  return specs;
}

async function main() {
  fs.mkdirSync(OUT_AUDIO_DIR, { recursive: true });
  const specs = collectSpecs();
  console.log(`Generating ${specs.length} clean natural Bangladeshi Bengali voice MP3 assets...`);

  const forceRegen = process.argv.includes('--force');
  const failed: VoiceSpec[] = [];
  let generatedCount = 0;
  let skippedCount = 0;

  let cursor = 0;
  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= specs.length) return;
      const spec = specs[idx];
      const outPath = path.join(OUT_AUDIO_DIR, `${spec.id}.mp3`);
      if (!forceRegen && fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
        skippedCount++;
        continue;
      }
      try {
        const mp3 = await generateClip(spec);
        fs.writeFileSync(outPath, mp3);
        generatedCount++;
        console.log(`[${idx + 1}/${specs.length}] OK ${spec.id}.mp3 (${spec.speaker}/${spec.emotion}, ${mp3.length}B)`);
      } catch (err) {
        console.error(`[${idx + 1}/${specs.length}] FAIL ${spec.id}:`, err instanceof Error ? err.message : err);
        failed.push(spec);
      }
    }
  }

  await Promise.all([worker(), worker(), worker(), worker()]);

  const exactMap: Record<string, string> = {};
  const fallbackMap: Record<string, string> = {};
  for (const spec of specs) {
    const url = `/assets/audio/voices/${spec.id}.mp3`;
    exactMap[`${spec.speaker}:${spec.emotion}:${spec.textBn}`] = url;
    fallbackMap[`${spec.speaker}:${spec.textBn}`] = url;
  }

  const manifestCode = `// AUTO-GENERATED BY scripts/generate-voices.ts — DO NOT EDIT MANUALLY
import { VoiceEmotion } from './types';

export type PreGeneratedSpeaker = 'narrator' | 'razon' | 'rasel';

export const PRE_GENERATED_EXACT_MAP: Record<string, string> = ${JSON.stringify(exactMap, null, 2)};

export const PRE_GENERATED_FALLBACK_MAP: Record<string, string> = ${JSON.stringify(fallbackMap, null, 2)};

export function resolvePreGeneratedVoiceUrl(
  text: string,
  speaker: PreGeneratedSpeaker,
  emotion: VoiceEmotion
): string | null {
  const exactKey = \`\${speaker}:\${emotion}:\${text}\`;
  if (PRE_GENERATED_EXACT_MAP[exactKey]) {
    return PRE_GENERATED_EXACT_MAP[exactKey];
  }
  const fallbackKey = \`\${speaker}:\${text}\`;
  return PRE_GENERATED_FALLBACK_MAP[fallbackKey] ?? null;
}
`;
  fs.writeFileSync(MANIFEST_PATH, manifestCode, 'utf8');

  console.log(`\nDone! Generated=${generatedCount}, Existing=${skippedCount}, Failed=${failed.length}`);
  if (failed.length > 0) {
    console.error('Failed items requiring manual recording or retry:');
    for (const f of failed) {
      console.error(` - ${f.id} (${f.speaker}/${f.emotion}): ${f.textBn}`);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
