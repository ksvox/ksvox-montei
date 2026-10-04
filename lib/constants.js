export const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyArfZ_vCwOTugIibk1N5BakUxUqWohKjII',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'ksvox-montei.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ksvox-montei',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:651588060010:web:584fb92b1346c3c0ee1b13',
};

export const CLASSES = ['正門下生', '門下生', 'レッスン生', 'ボイトレ'];

export const GENRES = ['ポップス', 'ロック', 'カントリー', 'R&B', 'HipHop', 'エレクトロ', 'ブルース', 'フォーク', 'ラテン', 'ソウル', 'ディスコ', 'バラード', 'その他'];
export const VOCALS = ['男性', '女性', '複数'];
export const MOODS = ['楽しい', '悲しい', '激しい', '優しい', '明るい', '暗い', '静か', '癒される', '元気が出る', 'セクシー', 'クール', 'ミステリアス', 'コミカル', '個性的'];

// ショーケース(K's VOX RECORD SHOWCASE)用のタグ
export const SOUNDS = ['ミニマル系', 'バンド系', 'エレクトリック系', 'オーケストラ系', 'ブラス系'];
export const VIBES = [
  { key: 'ポップ', desc: '明るく親しみやすい' },
  { key: 'ダーク', desc: '重く暗い' },
  { key: 'ディープ', desc: '内省的で深い' },
  { key: 'シャイニー', desc: '華やかできらびやか' },
  { key: 'クール', desc: 'かっこいい、洗練された' },
  { key: 'ユニーク', desc: '個性的、ひと味違う' },
];
export const TEMPOS = ['ゆったり', 'ほどよい', 'ノリノリ'];
export const TAG_MAX = 2; // サウンド・雰囲気は1曲につき2個まで
export const KSVOX_TOPIC_CHANNEL = 'UCw086s5lodBVcph8nxEZNvQ'; // YouTube「K's VOX - Topic」

export const SINGERS = ['男性', '女性'];
export const TONES = ['Pop', 'Dark', 'Sad', 'Cute', 'Chill', 'Cool', 'Romantic', 'Powerful', 'Electric', 'Emotional'];

export const FORUM_CATEGORIES = ['お知らせ', '質問', '雑談'];
export const EVENT_TYPES = [
  { key: 'lesson', label: 'レッスン', color: '#E54D26' },
  { key: 'practice', label: '練習', color: '#C5A059' },
  { key: 'event', label: 'イベント', color: '#5B7FA3' },
];

export const DEFAULT_SETTINGS = {
  reserveUrl: 'https://liff.line.me/2008830445-3seE8sbD?liff_id=2008830445-3seE8sbD&is=zfDyFlX3ni',
  paypayUrl: 'paypay://pay',
  paypayId: 'nobu_ksvox',
  bannerImage: '',
};

export const DEFAULT_APPS = [
  { name: '朗読AIコーチ', desc: 'あなたの朗読音声をAIが分析します', color: '#7A5BA6' },
  { name: '英語歌唱お助けAI', desc: '英語の歌詞を歌唱用に解析します', color: '#2F7FB5' },
  { name: '課題曲AIソムリエ', desc: '条件に近い課題曲を提案します', color: '#C23B4E' },
  { name: 'リズムAIマスター', desc: 'いつでも手軽にリズムトレーニング', color: '#C98A1B' },
  { name: 'Song Ripple', desc: 'AIを使って音楽をインサート・サーチ', color: '#1C93A8' },
  { name: 'Globe Track', desc: '世界で"今"聴かれている曲は?', color: '#2E3A78' },
];

export const AI_NOTES = [
  'エラーが出た場合は時間を空けて再実行してください。',
  'サーバーが混雑していると正しく実行されないことがあります。',
  '無料で運用しています。一度に繰り返しの利用は避けてください。',
  'あくまでもAIです。参考・ヒントとしてご活用ください。',
];

export const KEEP_LIMIT = 10;
