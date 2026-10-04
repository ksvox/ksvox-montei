// 曲登録・連続タグ付けで共通の「ショーケース用」入力欄
import { Chip } from '../ui';
import { SOUNDS, VIBES, TEMPOS, VOCALS } from '../../lib/constants';
import { toggleMax } from '../../lib/showcaseTags';
import { youtubeId } from '../../lib/utils';

function Group({ title, note, children }) {
  return (
    <div className="mb-4">
      <p className="text-sm font-bold text-ks-sub mb-1.5">{title}{note && <span className="font-normal text-xs ml-2">{note}</span>}</p>
      {children}
    </div>
  );
}

export function YoutubePreview({ url, id }) {
  const v = id || youtubeId(url);
  if (!v) return null;
  return (
    <div className="rounded-xl overflow-hidden bg-black mb-3" style={{ aspectRatio: '16 / 9' }}>
      <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${v}`} title="YouTube" allow="autoplay; encrypted-media" allowFullScreen />
    </div>
  );
}

export default function ShowcaseFields({ form, setForm, showVocal = false, showYoutube = true, releases = [] }) {
  return (
    <div>
      <Group title="収録作品(EP・アルバム名)" note="ショーケースで同じ作品の曲が偏らないように使います">
        <input className="input" list="ks-release-list" placeholder="例:For Better, For Us" value={form.release || ''}
          onChange={(e) => setForm({ ...form, release: e.target.value })} />
        <datalist id="ks-release-list">{releases.map((r) => <option key={r} value={r} />)}</datalist>
      </Group>
      {showYoutube && (
        <Group title="YouTube URL" note="「K's VOX - Topic」の動画">
          <input className="input mb-2" placeholder="https://www.youtube.com/watch?v=…" value={form.youtubeUrl || ''}
            onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} />
          {form.youtubeUrl && !youtubeId(form.youtubeUrl) && <p className="text-xs text-ks-red mb-2">YouTubeのURLとして読み取れません。</p>}
          <YoutubePreview url={form.youtubeUrl} />
        </Group>
      )}
      {showVocal && (
        <Group title="ボーカル">
          <div className="flex gap-2">{VOCALS.map((v) => <Chip key={v} active={form.vocal === v} onClick={() => setForm({ ...form, vocal: v })}>{v}</Chip>)}</div>
        </Group>
      )}
      <Group title="サウンド" note="2つまで">
        <div className="flex flex-wrap gap-2">{SOUNDS.map((s) => <Chip key={s} active={(form.sounds || []).includes(s)} onClick={() => setForm({ ...form, sounds: toggleMax(form.sounds, s) })}>{s}</Chip>)}</div>
      </Group>
      <Group title="雰囲気" note="2つまで">
        <div className="flex flex-wrap gap-2">
          {VIBES.map((v) => (
            <Chip key={v.key} active={(form.vibes || []).includes(v.key)} onClick={() => setForm({ ...form, vibes: toggleMax(form.vibes, v.key) })}>
              {v.key}<span className="text-[10px] opacity-70 ml-1">{v.desc}</span>
            </Chip>
          ))}
        </div>
      </Group>
      <Group title="テンポ">
        <div className="flex gap-2">{TEMPOS.map((t) => <Chip key={t} active={form.tempo === t} onClick={() => setForm({ ...form, tempo: form.tempo === t ? '' : t })}>{t}</Chip>)}</div>
      </Group>
    </div>
  );
}
