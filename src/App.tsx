import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { remove, uploadData } from 'aws-amplify/storage';
import { Amplify } from 'aws-amplify';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import '@aws-amplify/ui-react/styles.css';
import type { Schema } from '../amplify/data/resource';
import './App.css';

const outputsModules = import.meta.glob('../amplify_outputs.json', { eager: true });
const outputsEntry = Object.values(outputsModules)[0] as
  | { default?: Parameters<typeof Amplify.configure>[0] }
  | Parameters<typeof Amplify.configure>[0]
  | undefined;

if (outputsEntry) {
  const config =
    typeof outputsEntry === 'object' && outputsEntry && 'default' in outputsEntry && outputsEntry.default
      ? outputsEntry.default
      : (outputsEntry as Parameters<typeof Amplify.configure>[0]);
  Amplify.configure(config);
}

const client = generateClient<Schema>({ authMode: 'apiKey' });

type Diary = Schema['Todo']['type'];
type SortOrder = 'desc' | 'asc';

// 日記本文の上限
const MAX_CHARS = 500;
// 「今日の出来事メモ」の上限
const MAX_MEMO_CHARS = 500;

const DIARY_PRESETS = [
  '今日は小さな出来事が、思いのほか心に残った。慌ただしさの隙間で、自分のペースを取り戻せる瞬間があった。',
  'メモを読み返すと、今日という日がちゃんと輪郭を持っている。完璧じゃなくても、歩いた跡は残っている。',
  '何気ない一文が、一日の温度を思い出させる。嬉しいことも、少しだけ疲れたことも、どちらも今日の一部だ。',
  '空の色も、会話の端も、全部が短い物語になった。書いておくと、明日の自分が少し優しくなれる気がする。',
  '今日は「できたこと」を数えたくなる夜。大きな成果じゃなくても、自分を労う理由は十分にある。',
  '箇条書きの隙間から、気持ちの本音がのぞいていた。言葉にすると、不思議と肩の力が抜けていく。',
];

const AI_COMMENTS = [
  'その観察眼、素敵です。日常のひとコマを丁寧に拾えている人は、きっと明日も穏やかに歩けます。',
  'よく頑張りました。短い文章のなかに、あなたの温度がちゃんと残っています。',
  '今日のあなたは、十分に誠実です。小さな記録が、やがて自信の種になりますよ。',
  '感情を言葉にできたこと自体が前進です。自分を責めすぎず、この余韻を大切にしてください。',
  'いい一日の切り取り方です。続きが楽しみになるような、温かい余白があります。',
];

function pickRandom(list: string[]) {
  return list[Math.floor(Math.random() * list.length)] ?? list[0];
}

function composeDiary(memo: string) {
  const snippet = memo.replace(/\s+/g, ' ').trim().slice(0, 36);
  const base = pickRandom(DIARY_PRESETS);
  const withMemo = snippet
    ? `${base} 「${snippet}」そんな情景が、いまも胸のあたりでゆっくり灯っている。`
    : base;
  return withMemo.slice(0, MAX_CHARS);
}

function formatDate(value?: string | null) {
  if (!value) return '日時未設定';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Date を、ローカルタイムゾーンの「YYYY-MM-DD」文字列に変換する。
 * toISOString().slice(0, 10) だとUTC基準になり、日本時間では
 * 日付がずれるため、ローカルの年月日を明示的に組み立てている。
 */
function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 「YYYY-MM-DD」文字列を、ローカル0時の Date に戻す（DatePicker の selected 用）。 */
function fromDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** createdAt（ISO文字列）を、フィルター比較用の「YYYY-MM-DD」（ローカル日付）に変換する。 */
function toLocalDateKey(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return toDateKey(date);
}

function toTime(value?: string | null) {
  const time = new Date(value ?? '').getTime();
  return Number.isNaN(time) ? null : time;
}

function App() {
  const [rawMemo, setRawMemo] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  // <input type="file"> は非制御のため、state を null にしても選択表示は消えない。ref 経由で value を空にする
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<Diary[]>([]);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // タイムライン操作用
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterDate, setFilterDate] = useState('');

  // 削除用の選択モード
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const memoLength = rawMemo.length;
  const memoOver = memoLength > MAX_MEMO_CHARS; // maxLength により通常は発生しない（念のための保険）
  const memoAtLimit = memoLength >= MAX_MEMO_CHARS;
  const canGenerate = rawMemo.trim().length > 0 && !memoOver && !generating;

  const overLimit = content.length > MAX_CHARS;
  const canPost = content.trim().length > 0 && !overLimit && !posting;

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const loadEntries = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data, errors } = await client.models.Todo.list();
      if (errors?.length) {
        throw new Error(errors.map((error) => error.message).join(', '));
      }
      // 並び替え・絞り込みは表示側（visibleEntries）で行うため、ここでは素の配列を保持する
      setEntries(data ?? []);
      setNotice(null);
    } catch (error) {
      console.error(error);
      setNotice(
        'タイムラインの取得に失敗しました。Amplify のデプロイ（amplify_outputs.json）を確認してください。',
      );
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  // クライアントサイドで「日付フィルター → 並び替え」を行う
  const visibleEntries = useMemo(() => {
    const filtered = filterDate
      ? entries.filter((entry) => toLocalDateKey(entry.createdAt) === filterDate)
      : entries;

    return [...filtered].sort((a, b) => {
      const aTime = toTime(a.createdAt);
      const bTime = toTime(b.createdAt);
      // 日時が不正なデータは常に末尾へ
      if (aTime === null && bTime === null) return 0;
      if (aTime === null) return 1;
      if (bTime === null) return -1;
      return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
    });
  }, [entries, filterDate, sortOrder]);

  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    visibleEntries.length > 0 && visibleEntries.every((entry) => selectedIds.has(entry.id));

  // 絞り込みを変えたら選択もリセットする（画面に見えていない日記を誤って消さないため）
  const changeFilterDate = (value: string) => {
    setFilterDate(value);
    setSelectedIds(new Set());
  };

  const toggleSelectMode = () => {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
    setDeleteMessage(null);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleEntries.map((entry) => entry.id)));
  };

  const handleDeleteSelected = async () => {
    if (selectedCount === 0 || deleting) return;
    const confirmed = window.confirm(
      `選択した${selectedCount}件の日記を削除します。この操作は元に戻せません。よろしいですか？`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteMessage(null);
    const targets = entries.filter((entry) => selectedIds.has(entry.id));

    const results = await Promise.allSettled(
      targets.map(async (entry) => {
        const { errors } = await client.models.Todo.delete({ id: entry.id });
        if (errors?.length) {
          throw new Error(errors.map((error) => error.message).join(', '));
        }
        // 画像の削除に失敗しても、日記の削除自体は成功として扱う
        if (entry.imageUrl) {
          try {
            await remove({ path: entry.imageUrl });
          } catch (error) {
            console.warn('画像の削除に失敗しました:', entry.imageUrl, error);
          }
        }
        return entry.id;
      }),
    );

    const deletedIds = new Set<string>();
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        deletedIds.add(result.value);
      } else {
        console.error(result.reason);
      }
    });

    setEntries((prev) => prev.filter((entry) => !deletedIds.has(entry.id)));
    setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => !deletedIds.has(id))));

    const failed = targets.length - deletedIds.size;
    if (failed === 0) {
      setSelectMode(false);
      setDeleteMessage(`${deletedIds.size}件の日記を削除しました。`);
    } else {
      setDeleteMessage(`${deletedIds.size}件を削除しました。${failed}件は削除に失敗しました。`);
    }
    setDeleting(false);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setNotice('AIが文章を生成中...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setContent(composeDiary(rawMemo));
    setGenerating(false);
    setNotice('書き起こしが完了しました。必要なら本文を整えて投稿してください。');
  };

  const handlePost = async () => {
    if (!canPost) return;
    setPosting(true);
    try {
      let imageUrl: string | undefined;
      if (file) {
        const path = `public/${Date.now()}_${file.name}`;
        await uploadData({ path, data: file }).result;
        imageUrl = path;
      }

      const { errors } = await client.models.Todo.create({
        rawMemo: rawMemo.trim() || undefined,
        content: content.trim(),
        imageUrl,
        aiComment: pickRandom(AI_COMMENTS),
        createdAt: new Date().toISOString(),
      } as any);

      if (errors?.length) {
        throw new Error(errors.map((error) => error.message).join(', '));
      }

      setRawMemo('');
      setContent('');
      clearFile();
      setNotice('日記を投稿しました。');
      await loadEntries();
    } catch (error) {
      console.error(error);
      setNotice('投稿に失敗しました。Storage / Data の接続を確認してください。');
    } finally {
      setPosting(false);
    }
  };

  const resultSummary = filterDate
    ? `${filterDate.replace(/-/g, '/')} の日記：${visibleEntries.length}件`
    : `全${entries.length}件`;

  return (
    <div className="diary-app">
      <header className="app-header">
        <p className="badge">
          <span className="badge-dot" />
          AI が裏で文章を紡いでいます
        </p>
        <h1>一行日記</h1>
        <p className="lede">
          箇条書きのメモを、500字以内の温かな日記へ。画像とともに、今日の自分を残しましょう。
        </p>
      </header>

      <section className="control-panel composer">
        <label className="field-label" htmlFor="raw-memo">
          今日の出来事メモ（箇条書き可・最大{MAX_MEMO_CHARS}文字）
        </label>
        <textarea
          id="raw-memo"
          className={memoOver ? 'is-invalid' : undefined}
          value={rawMemo}
          onChange={(event) => setRawMemo(event.target.value)}
          placeholder={'・朝カフェで新しい豆を試した\n・仕事で小さな進捗があった\n・夜は少しだけ早寝できた'}
          rows={5}
          maxLength={MAX_MEMO_CHARS}
          aria-invalid={memoOver}
          aria-describedby="memo-footer"
        />
        <div className="field-footer" id="memo-footer">
          {memoOver ? (
            <p className="warning-text" role="alert">
              {memoLength - MAX_MEMO_CHARS}文字オーバーしています。{MAX_MEMO_CHARS}文字以内に収めてください。
            </p>
          ) : memoAtLimit ? (
            <p className="warning-text" role="status">
              上限の{MAX_MEMO_CHARS}文字に達しました。これ以上は入力できません。
            </p>
          ) : (
            <span />
          )}
          <span className={`char-count ${memoAtLimit ? 'over' : ''}`}>
            {memoLength} / {MAX_MEMO_CHARS}
          </span>
        </div>

        <button
          type="button"
          className="btn-secondary btn-generate"
          onClick={() => void handleGenerate()}
          disabled={!canGenerate}
        >
          {generating ? 'AIが文章を生成中...' : 'AIに日記を書いてもらう'}
        </button>

        {generating && (
          <div className="ai-loading" role="status">
            <span className="spark" />
            言葉の粒を選んでいます。3秒だけ、待っていてください。
          </div>
        )}

        <label className="field-label" htmlFor="diary-body">
          日記本文
        </label>
        <textarea
          id="diary-body"
          className={overLimit ? 'is-invalid' : undefined}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="ここに日記本文（最大500字）が入ります"
          rows={4}
        />
        <div className="field-footer">
          {overLimit ? (
            <p className="warning-text" role="alert">
              {content.length - MAX_CHARS}文字オーバーしています。{MAX_CHARS}文字以内に収めてください。
            </p>
          ) : (
            <span />
          )}
          <span className={`char-count ${overLimit ? 'over' : ''}`}>
            {content.length} / {MAX_CHARS}
          </span>
        </div>

        <label className="field-label" htmlFor="diary-image">
          今日の一枚
        </label>
        <input
          id="diary-image"
          className="file-input"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        {previewUrl && (
          <>
            <img className="preview-image" src={previewUrl} alt="選択した画像のプレビュー" />
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={clearFile}
              disabled={posting}
            >
              画像を選択解除
            </button>
          </>
        )}

        <button type="button" className="btn-primary" onClick={() => void handlePost()} disabled={!canPost}>
          {posting ? '投稿しています...' : '投稿する'}
        </button>

        {notice && <p className="notice">{notice}</p>}
      </section>

      <section className="timeline">
        <div className="timeline-head">
          <h2>タイムライン</h2>
          <p>{sortOrder === 'desc' ? '新しい順に並びます' : '古い順に並びます'}</p>
        </div>

        <div className="control-panel toolbar" role="group" aria-label="タイムラインの操作">
          <div className="toolbar-field">
            <label className="field-label" htmlFor="sort-order">
              並び順
            </label>
            <select
              id="sort-order"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            >
              <option value="desc">新しい順</option>
              <option value="asc">古い順</option>
            </select>
          </div>

          <div className="toolbar-field">
            <label className="field-label" htmlFor="filter-date">
              日付で絞り込み
            </label>
            <div className="toolbar-date">
              <DatePicker
                id="filter-date"
                selected={filterDate ? fromDateKey(filterDate) : null}
                onChange={(date: Date | null) => changeFilterDate(date ? toDateKey(date) : '')}
                dateFormat="yyyy/MM/dd"
                placeholderText="Select date"
                popperPlacement="bottom-start"
                showPopperArrow={false}
                calendarClassName="diary-calendar"
                autoComplete="off"
              />
              <button
                type="button"
                className="btn-secondary toolbar-clear"
                onClick={() => changeFilterDate('')}
                disabled={!filterDate}
              >
                クリア
              </button>
            </div>
          </div>

          <p className="toolbar-summary" aria-live="polite">
            {resultSummary}
          </p>
        </div>

        {entries.length > 0 && (
          <div className="select-bar">
            <button type="button" className="btn-secondary btn-small" onClick={toggleSelectMode} disabled={deleting}>
              {selectMode ? '選択を終了' : '選択'}
            </button>
            {selectMode && (
              <>
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={toggleSelectAll}
                  disabled={deleting || visibleEntries.length === 0}
                >
                  {allVisibleSelected ? 'すべて解除' : 'すべて選択'}
                </button>
                <button
                  type="button"
                  className="btn-danger btn-small"
                  onClick={() => void handleDeleteSelected()}
                  disabled={selectedCount === 0 || deleting}
                >
                  {deleting ? '削除しています...' : `選択した${selectedCount}件を削除`}
                </button>
              </>
            )}
          </div>
        )}

        {deleteMessage && (
          <p className="notice" role="status">
            {deleteMessage}
          </p>
        )}

        {loadingList && <p className="muted">読み込み中...</p>}

        {!loadingList && entries.length === 0 && (
          <div className="control-panel empty-state">まだ日記がありません。最初の一行を残してみましょう。</div>
        )}

        {!loadingList && entries.length > 0 && visibleEntries.length === 0 && (
          <div className="control-panel empty-state">
            <p>この日の日記はありません。</p>
            <button type="button" className="btn-secondary" onClick={() => changeFilterDate('')}>
              絞り込みを解除
            </button>
          </div>
        )}

        <ul className="entry-list">
          {visibleEntries.map((entry) => {
            const selected = selectedIds.has(entry.id);
            return (
              <li key={entry.id} className={`diary-card ${selected ? 'is-selected' : ''}`}>
                {selectMode ? (
                  <label className="entry-select">
                    <input
                      type="checkbox"
                      className="entry-checkbox"
                      checked={selected}
                      onChange={() => toggleSelected(entry.id)}
                      disabled={deleting}
                    />
                    <time className="entry-date">{formatDate(entry.createdAt)}</time>
                  </label>
                ) : (
                  <time className="entry-date">{formatDate(entry.createdAt)}</time>
                )}
                <p className="entry-body">{entry.content}</p>
                {entry.aiComment && (
                  <blockquote className="ai-comment">
                    <span>AIからのひとこと</span>
                    {entry.aiComment}
                  </blockquote>
                )}
                {entry.imageUrl && (
                  <div className="entry-image">
                    <StorageImage alt="日記の画像" path={entry.imageUrl} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export default App;
