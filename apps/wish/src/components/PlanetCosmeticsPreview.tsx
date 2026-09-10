import { useState, type ReactNode } from 'react'
import type { ItemId } from '@orbit/wish-core/items'
import { PATTERN_IDS } from '../planet'
import {
  BACKGROUND_PRESETS,
  COMPANION_PRESETS,
  EFFECT_PRESETS,
  PALETTE_PRESETS,
  RING_PRESETS,
} from '../cosmetics'
import { ITEM_LABELS } from '../lib/items'
import { PixelPlanet, type PixelPlanetProps } from './PixelPlanet'
import './PlanetCosmeticsPreview.css'

type PreviewSelection = Pick<
  PixelPlanetProps,
  'planetColorId' | 'planetPatternId' | 'ringId' | 'backgroundId' | 'companionId' | 'effectId'
>

const nameOf = (id: string) => ITEM_LABELS[id as ItemId]?.name ?? id

const SIZES = [32, 40, 64, 132] as const
const STAGES = [
  { label: '고리 60', progress: 60 },
  { label: '위성대 80', progress: 80 },
  { label: '성계 100', progress: 100 },
] as const

interface Stage { size: number; progress: number; palette?: string; seed: number }

function PreviewCard({ id, name, selection, stage }: {
  id: string
  name: string
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
          planetColorId={selection.planetColorId ?? stage.palette}
          planetPatternId={selection.planetPatternId}
          ringId={selection.ringId}
          backgroundId={selection.backgroundId}
          companionId={selection.companionId}
          effectId={selection.effectId}
        />
      </div>
      <strong>{name}</strong>
      <code>{id}</code>
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
      <PreviewSection eyebrow="COLOR" title="행성 색">
        {PALETTE_PRESETS.map((preset) => (
          <PreviewCard
            key={preset.id}
            id={preset.id}
            name={nameOf(preset.id)}
            stage={stage}
            selection={{ planetColorId: preset.id }}
          />
        ))}
      </PreviewSection>

      <PreviewSection eyebrow="PATTERN" title="행성 무늬">
        {PATTERN_IDS.map((id) => (
          <PreviewCard key={id} id={id} name={nameOf(id)} stage={stage} selection={{ planetPatternId: id }} />
        ))}
      </PreviewSection>

      <PreviewSection eyebrow="RING" title="궤도 링">
        <PreviewCard id="—" name="프리셋 없음" stage={stage} selection={{}} />
        {RING_PRESETS.map((preset) => (
          <PreviewCard
            key={preset.id}
            id={preset.id}
            name={nameOf(preset.id)}
            stage={stage}
            selection={{ ringId: preset.id }}
          />
        ))}
      </PreviewSection>

      <PreviewSection eyebrow="COMPANION" title="위성·동료">
        <PreviewCard id="—" name="프리셋 없음" stage={stage} selection={{}} />
        {COMPANION_PRESETS.map((preset) => (
          <PreviewCard
            key={preset.id}
            id={preset.id}
            name={nameOf(preset.id)}
            stage={stage}
            selection={{ companionId: preset.id }}
          />
        ))}
      </PreviewSection>

      <PreviewSection eyebrow="SYSTEM" title="성계 배경">
        <PreviewCard id="—" name="프리셋 없음" stage={stage} selection={{}} />
        {BACKGROUND_PRESETS.map((preset) => (
          <PreviewCard
            key={preset.id}
            id={preset.id}
            name={nameOf(preset.id)}
            stage={stage}
            selection={{ backgroundId: preset.id }}
          />
        ))}
      </PreviewSection>

      <PreviewSection eyebrow="EFFECT" title="완주 효과">
        <PreviewCard id="—" name="프리셋 없음" stage={stage} selection={{}} />
        {EFFECT_PRESETS.map((preset) => (
          <PreviewCard
            key={preset.id}
            id={preset.id}
            name={nameOf(preset.id)}
            stage={stage}
            selection={{ effectId: preset.id }}
          />
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
  const [palette, setPalette] = useState<string>('planet-color-solar')
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
                {nameOf(preset.id)}
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
                planetColorId={palette}
                planetPatternId="planet-pattern-crystal"
                ringId="ring-debris"
                backgroundId="background-constellation"
                companionId="companion-probe"
                effectId="effect-comet-trail"
              />
              <figcaption>{value}px</figcaption>
            </figure>
          ))}
        </div>
      </PreviewSection>
    </main>
  )
}
