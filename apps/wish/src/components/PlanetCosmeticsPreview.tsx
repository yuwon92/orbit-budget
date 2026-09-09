import { useState, type ReactNode } from 'react'
import {
  BACKGROUND_PRESETS,
  COMPLETION_EFFECT_PRESETS,
  DECORATION_PRESETS,
  PALETTE_PRESETS,
  RING_PRESETS,
} from '../cosmetics'
import { PixelPlanet, type PixelPlanetProps } from './PixelPlanet'
import './PlanetCosmeticsPreview.css'

type PreviewSelection = Pick<
  PixelPlanetProps,
  'paletteId' | 'ringId' | 'decorationId' | 'backgroundId' | 'completionEffectId'
>

const SIZES = [32, 40, 64, 132] as const
const STAGES = [
  { label: '고리 60', progress: 60 },
  { label: '위성대 80', progress: 80 },
  { label: '성계 100', progress: 100 },
] as const

interface Stage { size: number; progress: number; palette?: string; seed: number }

function PreviewCard({ id, name, unlockLevel, selection, stage }: {
  id: string
  name: string
  unlockLevel?: number
  selection: PreviewSelection
  stage: Stage
}) {
  return (
    <article className="cosmetics-preview-card">
      <div className="cosmetics-preview-planet" style={{ minHeight: stage.size + 8 }}>
        <PixelPlanet
          progress={stage.progress}
          seed={stage.seed}
          size={stage.size}
          paletteId={selection.paletteId ?? stage.palette}
          ringId={selection.ringId}
          decorationId={selection.decorationId}
          backgroundId={selection.backgroundId}
          completionEffectId={selection.completionEffectId}
        />
      </div>
      <strong>{name}</strong>
      <code>{id}</code>
      <small>{unlockLevel ? `LV.${unlockLevel}` : '기준'}</small>
    </article>
  )
}

function PreviewSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="cosmetics-preview-section">
      <header><span className="pixel-label">{eyebrow}</span><h2>{title}</h2></header>
      <div className="cosmetics-preview-grid">{children}</div>
    </section>
  )
}

function PresetGallery({ stage }: { stage: Stage }) {
  return (
    <>
      <PreviewSection eyebrow="PALETTE" title="행성 팔레트">
        {PALETTE_PRESETS.map((preset) => (
          <PreviewCard key={preset.id} {...preset} stage={stage} selection={{ paletteId: preset.id }} />
        ))}
      </PreviewSection>

      <PreviewSection eyebrow="RING" title="링 패턴">
        <PreviewCard id="—" name="프리셋 없음" stage={stage} selection={{}} />
        {RING_PRESETS.map((preset) => (
          <PreviewCard key={preset.id} {...preset} stage={stage} selection={{ ringId: preset.id }} />
        ))}
      </PreviewSection>

      <PreviewSection eyebrow="ORBIT" title="궤도 장식">
        <PreviewCard id="—" name="프리셋 없음" stage={stage} selection={{}} />
        {DECORATION_PRESETS.map((preset) => (
          <PreviewCard key={preset.id} {...preset} stage={stage} selection={{ decorationId: preset.id }} />
        ))}
      </PreviewSection>

      <PreviewSection eyebrow="SYSTEM" title="성계 배경">
        <PreviewCard id="—" name="프리셋 없음" stage={stage} selection={{}} />
        {BACKGROUND_PRESETS.map((preset) => (
          <PreviewCard key={preset.id} {...preset} stage={stage} selection={{ backgroundId: preset.id }} />
        ))}
      </PreviewSection>

      <PreviewSection eyebrow="COMPLETE" title="완주 효과">
        <PreviewCard id="—" name="프리셋 없음" stage={stage} selection={{}} />
        {COMPLETION_EFFECT_PRESETS.map((preset) => (
          <PreviewCard key={preset.id} {...preset} stage={stage} selection={{ completionEffectId: preset.id }} />
        ))}
      </PreviewSection>
    </>
  )
}

/**
 * 개발 전용 비교 화면. 앱 탭에는 연결하지 않으며 `?cosmetics-preview`로만 연다.
 * 제품 저장 상태를 읽거나 쓰지 않는다.
 */
export function PlanetCosmeticsPreview() {
  const [size, setSize] = useState<number>(64)
  const [progress, setProgress] = useState<number>(100)
  const [palette, setPalette] = useState<string>('solar')
  const [seed, setSeed] = useState<number>(7)
  const stage: Stage = { size, progress, palette, seed }

  return (
    <main className="cosmetics-preview">
      <header className="cosmetics-preview-head">
        <span className="pixel-label">DEVELOPMENT PREVIEW</span>
        <h1>행성 꾸미기 프리셋</h1>
        <p>프리셋 비교용 · 저장 없음 · 라이트/다크 동시 확인</p>
      </header>

      <div className="cosmetics-preview-controls">
        <div className="cosmetics-preview-control">
          <span className="pixel-label">SIZE</span>
          <div className="cosmetics-preview-choices">
            {SIZES.map((value) => (
              <button key={value} type="button" aria-pressed={size === value} onClick={() => setSize(value)}>
                {value}px
              </button>
            ))}
          </div>
        </div>
        <div className="cosmetics-preview-control">
          <span className="pixel-label">STAGE</span>
          <div className="cosmetics-preview-choices">
            {STAGES.map((item) => (
              <button
                key={item.progress}
                type="button"
                aria-pressed={progress === item.progress}
                onClick={() => setProgress(item.progress)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="cosmetics-preview-control">
          <span className="pixel-label">PALETTE</span>
          <div className="cosmetics-preview-choices">
            {PALETTE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={palette === preset.id}
                onClick={() => setPalette(preset.id)}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
        <div className="cosmetics-preview-control">
          <span className="pixel-label">SEED</span>
          <div className="cosmetics-preview-choices">
            {[7, 11, 23, 42].map((value) => (
              <button key={value} type="button" aria-pressed={seed === value} onClick={() => setSeed(value)}>
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="cosmetics-preview-themes">
        <div className="cosmetics-preview-theme preview-light">
          <span className="pixel-label">LIGHT</span>
          <PresetGallery stage={stage} />
        </div>
        <div className="cosmetics-preview-theme preview-dark">
          <span className="pixel-label">DARK</span>
          <PresetGallery stage={stage} />
        </div>
      </div>

      <PreviewSection eyebrow="SIZE CHECK" title="작은 크기 판독성">
        <div className="cosmetics-size-row">
          {SIZES.map((value) => (
            <figure key={value}>
              <PixelPlanet
                progress={100}
                seed={seed}
                size={value}
                paletteId={palette}
                ringId="debris"
                decorationId="probe"
                backgroundId="constellation"
                completionEffectId="comet-trail"
              />
              <figcaption>{value}px</figcaption>
            </figure>
          ))}
        </div>
      </PreviewSection>
    </main>
  )
}
